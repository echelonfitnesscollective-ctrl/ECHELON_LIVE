// Vercel serverless proxy for ECHELON FUEL TRACKER food search.
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_ANON_KEY,
// USDA_FDC_API_KEY. OPEN_FOOD_FACTS_USER_AGENT is optional but recommended.

const MAX_QUERY_LENGTH = 80;
const inMemoryRateLimit = new Map();

function normaliseFood(source, item) {
  if (source === 'USDA') {
    const nutrients = Object.fromEntries((item.foodNutrients || []).map((n) => [n.nutrientName, n.value]));
    return { id: `usda-${item.fdcId}`, source: 'USDA', sourceFoodId: String(item.fdcId), name: item.description, brand: item.brandOwner || item.brandName || '', servingDescription: item.householdServingFullText || `${item.servingSize || 100} g`, servingGrams: Number(item.servingSize) || 100, calories: Number(nutrients['Energy'] || 0), proteinGrams: Number(nutrients['Protein'] || 0), carbohydrateGrams: Number(nutrients['Carbohydrate, by difference'] || 0), fatGrams: Number(nutrients['Total lipid (fat)'] || 0) };
  }
  const n = item.nutriments || {};
  return { id: `off-${item.code || item._id}`, source: 'Open Food Facts', sourceFoodId: String(item.code || item._id || ''), name: item.product_name || item.generic_name || 'Unnamed product', brand: item.brands || '', servingDescription: item.serving_size || '100 g', servingGrams: Number(n['serving_quantity'] || 100), calories: Number(n['energy-kcal_serving'] || n['energy-kcal_100g'] || 0), proteinGrams: Number(n.proteins_serving || n.proteins_100g || 0), carbohydrateGrams: Number(n.carbohydrates_serving || n.carbohydrates_100g || 0), fatGrams: Number(n.fat_serving || n.fat_100g || 0), barcode: item.code || null };
}

async function authenticated(request) {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ') || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return false;
  const userResponse = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: header } });
  if (!userResponse.ok) return false;
  const accessResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/has_member_hub_access`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: header, 'content-type': 'application/json' },
    body: '{}'
  });
  return accessResponse.ok && (await accessResponse.json()) === true;
}

export default async function handler(request, response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  if (!(await authenticated(request))) return response.status(401).json({ error: 'Sign in required' });
  const query = String(request.query.q || '').trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 3) return response.status(400).json({ error: 'Enter at least three characters.' });
  const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const fingerprint = `${ip}:${query.toLowerCase()}`;
  if (inMemoryRateLimit.get(fingerprint) > Date.now() - 1200) return response.status(429).json({ error: 'Please wait a moment before searching again.' });
  inMemoryRateLimit.set(fingerprint, Date.now());
  if (inMemoryRateLimit.size > 500) {
    const cutoff = Date.now() - 60_000;
    for (const [key, timestamp] of inMemoryRateLimit) if (timestamp < cutoff) inMemoryRateLimit.delete(key);
  }
  try {
    const jobs = [];
    if (process.env.USDA_FDC_API_KEY) jobs.push(fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(process.env.USDA_FDC_API_KEY)}&query=${encodeURIComponent(query)}&pageSize=8`).then(async (res) => res.ok ? (await res.json()).foods?.map((food) => normaliseFood('USDA', food)) || [] : []));
    jobs.push(fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8`, { headers: { 'User-Agent': process.env.OPEN_FOOD_FACTS_USER_AGENT || 'EchelonFuelTracker/1.0 support@echelonfitness.co' } }).then(async (res) => res.ok ? (await res.json()).products?.filter((food) => food.product_name || food.generic_name).map((food) => normaliseFood('Open Food Facts', food)) || [] : []));
    const results = (await Promise.all(jobs)).flat().filter((food) => food.name && Number.isFinite(food.calories)).slice(0, 12);
    return response.status(200).json({ foods: results });
  } catch (error) {
    console.error('Echelon nutrition search provider error', error?.message);
    return response.status(503).json({ error: 'Food search is temporarily unavailable.' });
  }
}
