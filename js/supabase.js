(function(){
  let client = null;

  function init() {
    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_KEY;
    if (!url || !key || !window.supabase) return false;
    if (!client) client = supabase.createClient(url, key);
    return true;
  }

  window.isSupabaseConfigured = function() {
    return !!(window.SUPABASE_URL && window.SUPABASE_KEY && window.supabase);
  };

  // Auth helpers
  window.supabaseSignInWithEmail = async function(email) {
    if (!init()) throw new Error('Supabase not configured');
    return client.auth.signInWithOtp({ email });
  };

  window.supabaseSignInWithProvider = async function(provider) {
    if (!init()) throw new Error('Supabase not configured');
    return client.auth.signInWithOAuth({ provider });
  };

  window.supabaseSignOut = async function() {
    if (!init()) throw new Error('Supabase not configured');
    return client.auth.signOut();
  };

  window.supabaseGetSession = async function() {
    if (!init()) return null;
    const { data } = await client.auth.getSession();
    return data?.session || null;
  };

  // Fetch a single user record by email (targeted lookup)
  window.supabaseFetchUserByEmail = async function(email) {
    if (!init()) throw new Error('Supabase not configured');
    if (!email) return { data: null, error: new Error('email required') };
    // use maybeSingle to avoid errors when not found
    const res = await client.from('users').select('*').eq('email', email).limit(1).maybeSingle();
    return res;
  };

  window.supabaseOnAuthChange = function(cb) {
    if (!init()) return () => {};
    const { data } = client.auth.onAuthStateChange((event, session) => cb(event, session));
    return data?.subscription ? () => data.subscription.unsubscribe() : () => {};
  };

  // Per-entity upsert
  async function upsertEntity(table, rows) {
    if (!init()) throw new Error('Supabase not configured');
    if (!rows || !rows.length) return { data: [], error: null };
    // Ensure updated_at column is set server-side; we include it when present
    return client.from(table).upsert(rows, { onConflict: 'id' });
  }

  async function fetchEntity(table, since) {
    if (!init()) throw new Error('Supabase not configured');
    let q = client.from(table).select('*');
    if (since) q = q.gt('updated_at', since);
    return q;
  }

  // Bulk push: upsert each entity array into its table
  window.supabasePushAll = async function(payload) {
    if (!init()) throw new Error('Supabase not configured');
    const tables = ['sites','supportRequests','users','organizations','communityReports','serviceProviders','developmentPartners','connections','notifications'];
    const results = {};
    for (const t of tables) {
      const rows = payload[t] || [];
      // Map JS names to SQL table names if needed
      const tableName = t; // assume same
      if (rows.length) {
        const { data, error } = await upsertEntity(tableName, rows);
        results[t] = { data, error };
        // If table not found, break and fallback to legacy single-row sync
        if (error && /could not find the table/i.test(error.message || '')) {
          results._tableMissing = t;
          break;
        }
      }
    }
    // If a table was missing, fallback to writing the whole payload into `sitecore_sync` table
    if (results._tableMissing) {
      try {
        const row = [{ id: 'workspace', payload }];
        const { data, error } = await client.from('sitecore_sync').upsert(row, { onConflict: 'id' });
        return { fallback: { data, error }, partial: results };
      } catch (e) {
        return { error: e, partial: results };
      }
    }

    return results;
  };

  // Bulk pull: fetch all rows for each table; if since provided, fetch only newer
  window.supabasePullAll = async function(since=null) {
    if (!init()) throw new Error('Supabase not configured');
    const tables = ['sites','supportRequests','users','organizations','communityReports','serviceProviders','developmentPartners','connections','notifications'];
    const payload = {};
    try {
      for (const t of tables) {
        const tableName = t;
        const { data, error } = await fetchEntity(tableName, since);
        if (error) throw error;
        payload[t] = data || [];
      }
      return payload;
    } catch (e) {
      // Fallback: attempt to read legacy single-row table `sitecore_sync`
      try {
        const { data, error } = await client.from('sitecore_sync').select('payload').eq('id', 'workspace').maybeSingle();
        if (error) throw error;
        if (data && data.payload) {
          return data.payload;
        }
      } catch (e2) {
        throw e; // rethrow original
      }
      throw e;
    }
  };

  // Delete a single entity row by id, with fallback to legacy single-row store
  window.supabaseDeleteEntity = async function(table, id) {
    if (!init()) throw new Error('Supabase not configured');
    try {
      const res = await client.from(table).delete().eq('id', id);
      if (res.error && /could not find the table/i.test(res.error.message || '')) {
        // fall through to fallback handling below
      } else {
        return res;
      }
    } catch (e) {
      // proceed to fallback
      console.warn('Delete via table failed, attempting fallback', e);
    }

    // Fallback: read workspace payload, remove item, upsert
    try {
      const { data, error } = await client.from('sitecore_sync').select('payload').eq('id', 'workspace').maybeSingle();
      if (error) throw error;
      const payload = (data && data.payload) ? data.payload : {};
      if (payload[table]) {
        payload[table] = payload[table].filter(r => r.id !== id);
      }
      const row = [{ id: 'workspace', payload }];
      return await client.from('sitecore_sync').upsert(row, { onConflict: 'id' });
    } catch (e2) {
      return { error: e2 };
    }
  };

  // Init on load if config present
  try { init(); } catch (e) { /* ignore */ }
})();
