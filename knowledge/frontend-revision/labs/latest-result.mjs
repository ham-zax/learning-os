import { pathToFileURL } from 'node:url';

// Deliberately faulty starter: the caller's latest intent must own publication.
// Keep load injected so completion order can be controlled without network luck.
export function createSearch(load) {
  const state = { value: null, error: null, loading: false };
  return {
    state,
    async search(query) {
      state.loading = true;
      state.error = null;
      try { state.value = await load(query); }
      catch (error) { state.error = error.message; }
      finally { state.loading = false; }
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pending = new Map();
  const app = createSearch((query) => new Promise((resolve, reject) => pending.set(query, { resolve, reject })));
  const older = app.search('first choice');
  const newer = app.search('second choice');
  pending.get('second choice').resolve('current result');
  await newer;
  console.log('after current', JSON.stringify(app.state));
  pending.get('first choice').resolve('obsolete result');
  await older;
  console.log('after obsolete', JSON.stringify(app.state));
}
