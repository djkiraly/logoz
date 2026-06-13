/**
 * Print product + variant counts per category from the database.
 *
 * Usage (on the server, from the app root):
 *   npm run category:counts
 *
 * Use it to verify an import: compare "products" (distinct styles) and
 * "variants" (Style x Color x Size rows) against the source catalog.
 */

// Mark as a module so top-level names don't collide with other scripts.
export {};

// Standalone process: load .env so DATABASE_URL is set (Node >= 20.12 / 22).
try {
  process.loadEnvFile('.env');
} catch {
  // already in environment
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function padEnd(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function padStart(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

async function main(): Promise<void> {
  const { prisma } = await import('../src/lib/prisma');

  const categories = await prisma.category.findMany({
    select: {
      id: true,
      title: true,
      _count: { select: { products: true } },
    },
    orderBy: { title: 'asc' },
  });

  const rows: { title: string; products: number; visible: number; variants: number }[] = [];
  let totalProducts = 0;
  let totalVisible = 0;
  let totalVariants = 0;

  for (const c of categories) {
    const [visible, variants] = await Promise.all([
      prisma.product.count({ where: { categoryId: c.id, visible: true } }),
      prisma.variant.count({ where: { product: { categoryId: c.id } } }),
    ]);
    rows.push({ title: c.title, products: c._count.products, visible, variants });
    totalProducts += c._count.products;
    totalVisible += visible;
    totalVariants += variants;
  }

  // Sort by product count, descending.
  rows.sort((a, b) => b.products - a.products);

  const titleW = Math.max(20, ...rows.map((r) => r.title.length), 'TOTAL'.length);
  const numW = 12;

  const header =
    padEnd('CATEGORY', titleW) + '  ' +
    padStart('PRODUCTS', numW) + '  ' +
    padStart('VISIBLE', numW) + '  ' +
    padStart('VARIANTS', numW);
  console.log('');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of rows) {
    console.log(
      padEnd(r.title, titleW) + '  ' +
      padStart(fmt(r.products), numW) + '  ' +
      padStart(fmt(r.visible), numW) + '  ' +
      padStart(fmt(r.variants), numW)
    );
  }

  console.log('-'.repeat(header.length));
  console.log(
    padEnd('TOTAL', titleW) + '  ' +
    padStart(fmt(totalProducts), numW) + '  ' +
    padStart(fmt(totalVisible), numW) + '  ' +
    padStart(fmt(totalVariants), numW)
  );
  console.log('');
  console.log(`${categories.length} categories.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('category:counts failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
