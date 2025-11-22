#!/bin/bash
set -e

echo "Building with bun..."
bun build src/index.ts --format esm --outfile dist/index.js --target node
bun build src/index.ts --format cjs --outfile dist/index.cjs --target node

echo "Generating type declarations..."
bunx tsc --emitDeclarationOnly --declaration --declarationDir dist/types --rootDir src

echo "Creating bundled type declarations..."
cat > dist/index.d.ts << 'DTSEOF'
#!/usr/bin/env node
export * from './types/index.js';
DTSEOF

cp dist/index.d.ts dist/index.d.cts

echo "Build complete!"
ls -lh dist/
