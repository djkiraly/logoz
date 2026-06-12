/**
 * CLI: import the SanMar SDL catalog file into the local database.
 *
 * Usage (run on the box where the file lives, e.g. the VPS):
 *   npm run import:sanmar -- <catalog-file> [options]
 *
 * <catalog-file> may be a path, or just the name of a file uploaded via the
 * admin Catalog Upload tab (resolved inside the shared catalog directory).
 *
 * Options:
 *   --list           List catalog files uploaded via the admin and exit
 *   --visible        Publish products immediately (default: hidden for review)
 *   --dry-run        Parse + map only; no database writes
 *   --limit=N        Import only the first N styles (smoke-test a slice)
 *   --progress=N     Emit a progress line every N styles (default 100)
 *
 * The file is huge, so it is streamed — memory stays flat regardless of size.
 */

// Load .env so the standalone process has DATABASE_URL (Next.js does this for
// the app, but a bare tsx process does not). Node >=20.12 / 22 built-in.
try {
  process.loadEnvFile('.env');
} catch {
  // .env may already be in the environment (e.g. PM2 / CI) — continue.
}

interface CliArgs {
  filePath?: string;
  list: boolean;
  visible: boolean;
  dryRun: boolean;
  limitStyles?: number;
  progressEvery?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let list = false;
  let visible = false;
  let dryRun = false;
  let limitStyles: number | undefined;
  let progressEvery: number | undefined;

  for (const arg of argv) {
    if (arg === '--list') list = true;
    else if (arg === '--visible') visible = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--limit=')) limitStyles = Number.parseInt(arg.slice(8), 10);
    else if (arg.startsWith('--progress=')) progressEvery = Number.parseInt(arg.slice(11), 10);
    else if (arg.startsWith('--')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    } else positional.push(arg);
  }

  if (!list && positional.length !== 1) {
    console.error('Usage: npm run import:sanmar -- <catalog-file> [--visible] [--dry-run] [--limit=N] [--progress=N]');
    console.error('       npm run import:sanmar -- --list');
    process.exit(2);
  }

  return { filePath: positional[0], list, visible, dryRun, limitStyles, progressEvery };
}

/**
 * Resolve the catalog file to import: an existing path is used as-is; otherwise
 * the argument is treated as the name of a file uploaded via the admin and
 * resolved inside the shared catalog directory.
 */
async function resolveInputPath(arg: string): Promise<string> {
  const { existsSync } = await import('node:fs');
  if (existsSync(arg)) return arg;

  const { resolveCatalogPath, getCatalogDir } = await import('../src/lib/sanmar/catalog-storage');
  try {
    const stored = await resolveCatalogPath(arg);
    if (existsSync(stored)) return stored;
    console.error(`File not found: "${arg}" (looked in ${getCatalogDir()})`);
  } catch (err) {
    console.error(`Invalid catalog file "${arg}": ${err instanceof Error ? err.message : err}`);
  }
  process.exit(2);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // --list: show uploaded catalog files and exit (no DB needed).
  if (args.list) {
    const { listCatalogFiles, getCatalogDir } = await import('../src/lib/sanmar/catalog-storage');
    const files = await listCatalogFiles();
    console.log(`Catalog directory: ${getCatalogDir()}`);
    if (files.length === 0) {
      console.log('  (no files)');
    } else {
      for (const f of files) {
        console.log(`  ${f.name}\t${(f.size / 1024 / 1024).toFixed(1)} MB\t${f.modifiedAt}`);
      }
    }
    process.exit(0);
  }

  const filePath = await resolveInputPath(args.filePath as string);

  // Dynamic import so .env is loaded before the Prisma client is constructed.
  const { importSdlCatalog } = await import('../src/lib/sanmar/sdl-import');
  const { prisma } = await import('../src/lib/prisma');

  const started = Date.now();
  console.log(`Importing SanMar catalog: ${filePath}`);
  if (args.dryRun) console.log('  (dry run — no database writes)');
  if (args.visible) console.log('  (products will be published immediately)');
  if (args.limitStyles != null) console.log(`  (limited to first ${args.limitStyles} styles)`);

  const fmt = (s: { stylesProcessed: number; productsCreated: number; productsUpdated: number; variantsUpserted: number; errors: number }) =>
    `styles=${s.stylesProcessed} created=${s.productsCreated} updated=${s.productsUpdated} variants=${s.variantsUpserted} errors=${s.errors}`;

  let samplesShown = 0;

  try {
    const summary = await importSdlCatalog({
      filePath,
      visible: args.visible,
      dryRun: args.dryRun,
      limitStyles: args.limitStyles,
      progressEvery: args.progressEvery,
      onProgress: (s) => console.log(`  ... ${fmt(s)}`),
      // On a dry run, print the first couple of mapped styles in full so the
      // column->field + image-link mapping can be verified before any write.
      onSample: (m) => {
        if (!args.dryRun || samplesShown >= 2) return;
        samplesShown += 1;
        console.log(`\n--- mapped style ${m.style} (${m.brand}) ---`);
        console.log(JSON.stringify({
          name: m.name,
          sanmarCategory: m.sanmarCategory,
          basePrice: m.basePrice,
          cost: m.cost,
          productStatus: m.productStatus,
          heroImageUrl: m.heroImageUrl,
          gallery: m.gallery,
          colorImages: m.colorImages,
          keywords: m.keywords,
          variantCount: m.variants.length,
          firstVariant: m.variants[0],
        }, null, 2));
      },
    });

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log('\nDone in ' + secs + 's');
    console.log(`  rows read:         ${summary.rowsRead}`);
    console.log(`  styles processed:  ${summary.stylesProcessed}`);
    console.log(`  products created:  ${summary.productsCreated}`);
    console.log(`  products updated:  ${summary.productsUpdated}`);
    console.log(`  variants upserted: ${summary.variantsUpserted}`);
    console.log(`  suppliers created: ${summary.suppliersCreated}`);
    console.log(`  errors:            ${summary.errors}`);

    await prisma.$disconnect();
    process.exit(summary.errors > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nImport failed:', err instanceof Error ? err.message : err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

void main();
