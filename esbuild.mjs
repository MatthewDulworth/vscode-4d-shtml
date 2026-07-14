import esbuild from 'esbuild';
const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'], bundle: true, outfile: 'dist/extension.js',
  platform: 'node', format: 'cjs', external: ['vscode'], sourcemap: true,
});
process.argv.includes('--watch') ? await ctx.watch() : (await ctx.rebuild(), await ctx.dispose());