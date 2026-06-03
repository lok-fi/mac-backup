'use strict';

/**
 * zoho-client.js
 *
 * Full Zoho CRM REST API client for India region.
 * Server-side replacement for the browser-only ZOHO.CRM.* JS SDK.
 *
 * Every method mirrors the tool definitions in the existing crm-tools.js
 * so Phase 3 (Gemini bridge) can reuse the same function declarations.
 *
 * Usage (inside a request handler):
 *   const store  = createTokenStore(catalyst.initialize(req, { type: 'admin' }));
 *   const crm    = createCRMClient(store);
 *   const leads  = await crm.searchRecords('Leads', 'John');
 */

const axios = require('axios');

const CRM_BASE = 'https://www.zohoapis.in/crm/v7';

// ─── Factory ──────────────────────────────────────────────────────────────────

function createCRMClient(tokenStore) {

  // Build auth headers, auto-refreshing token if needed
  async function _headers() {
    const token = await tokenStore.getValidAccessToken();
    return {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type':  'application/json'
    };
  }

  // Extract the real Zoho error message from an axios error response
  function _zohoError(err) {
    const body = err.response?.data;
    if (!body) return err.message;
    // Zoho returns { code, message, status } or { data: [{ code, message }] }
    const msg = body.message || body.data?.[0]?.message || body.code || JSON.stringify(body);
    return `Zoho: ${msg}`;
  }

  // Core GET
  async function _get(path, params = {}) {
    try {
      const res = await axios.get(`${CRM_BASE}${path}`, { headers: await _headers(), params });
      return res.data;
    } catch (err) { throw new Error(_zohoError(err)); }
  }

  // Core POST
  async function _post(path, body) {
    try {
      const res = await axios.post(`${CRM_BASE}${path}`, body, { headers: await _headers() });
      return res.data;
    } catch (err) { throw new Error(_zohoError(err)); }
  }

  // Core PUT
  async function _put(path, body) {
    try {
      const res = await axios.put(`${CRM_BASE}${path}`, body, { headers: await _headers() });
      return res.data;
    } catch (err) { throw new Error(_zohoError(err)); }
  }

  // Core DELETE
  async function _delete(path) {
    try {
      const res = await axios.delete(`${CRM_BASE}${path}`, { headers: await _headers() });
      return res.data;
    } catch (err) { throw new Error(_zohoError(err)); }
  }

  // ─── Tool: list_modules ────────────────────────────────────────────────────
  async function listModules() {
    const data = await _get('/settings/modules');
    return (data.modules || []).map(m => ({
      api_name:    m.api_name,
      display_name: m.plural_label,
      visible:     m.visible
    }));
  }

  // ─── Tool: get_module_fields ───────────────────────────────────────────────
  async function getModuleFields(moduleName) {
    const data = await _get('/settings/fields', { module: moduleName });
    return (data.fields || []).map(f => {
      const field = {
        api_name:      f.api_name,
        display_label: f.field_label,
        data_type:     f.data_type,
        required:      f.system_mandatory || false
      };
      // Include picklist / dropdown options so the UI can show them
      if (f.pick_list_values?.length) {
        field.options = f.pick_list_values.map(p => p.display_value || p.actual_value).filter(Boolean);
      }
      return field;
    });
  }

  // ─── Tool: search_records ──────────────────────────────────────────────────
  /**
   * @param {string} moduleName   e.g. "Leads", "Contacts", "Deals"
   * @param {string} searchTerm   free-text search
   * @param {string[]} fields     specific fields to return (optional)
   * @param {number} page
   * @param {number} perPage      max 200
   */
  async function searchRecords(moduleName, searchTerm, fields = [], page = 1, perPage = 10) {
    const params = {
      word:     searchTerm,
      page,
      per_page: perPage
    };
    if (fields.length > 0) params.fields = fields.join(',');

    try {
      const data = await _get(`/${moduleName}/search`, params);
      return {
        records: data.data || [],
        info:    data.info  || {}
      };
    } catch (err) {
      // 204 No Content = no results found (Zoho returns this instead of empty array)
      if (err.response?.status === 204) return { records: [], info: {} };
      throw err;
    }
  }

  // ─── Tool: get_record ──────────────────────────────────────────────────────
  async function getRecord(moduleName, recordId, fields = []) {
    const params = {};
    if (fields.length > 0) params.fields = fields.join(',');
    const data = await _get(`/${moduleName}/${recordId}`, params);
    return data.data?.[0] || null;
  }

  // ─── Tool: create_record ───────────────────────────────────────────────────
  async function createRecord(moduleName, recordData) {
    const body = { data: [recordData] };
    const data = await _post(`/${moduleName}`, body);
    const result = data.data?.[0];
    if (result?.code !== 'SUCCESS') {
      throw new Error(`Create failed: ${result?.message || JSON.stringify(result)}`);
    }
    return { id: result.details?.id, status: 'created' };
  }

  // ─── Tool: update_record ───────────────────────────────────────────────────
  async function updateRecord(moduleName, recordId, recordData) {
    const body = { data: [{ id: recordId, ...recordData }] };
    const data = await _put(`/${moduleName}`, body);
    const result = data.data?.[0];
    if (result?.code !== 'SUCCESS') {
      throw new Error(`Update failed: ${result?.message || JSON.stringify(result)}`);
    }
    return { id: recordId, status: 'updated' };
  }

  // ─── Tool: delete_record ───────────────────────────────────────────────────
  async function deleteRecord(moduleName, recordId) {
    const data = await _delete(`/${moduleName}/${recordId}`);
    const result = data.data?.[0];
    if (result?.code !== 'SUCCESS') {
      throw new Error(`Delete failed: ${result?.message || JSON.stringify(result)}`);
    }
    return { id: recordId, status: 'deleted' };
  }

  // ─── Tool: convert_lead ────────────────────────────────────────────────────
  /**
   * @param {string} leadId
   * @param {object} options  { createDeal, dealName, accountName, contactId }
   */
  async function convertLead(leadId, options = {}) {
    const payload = {
      overwrite:               true,
      notify_lead_owner:       true,
      notify_new_entity_owner: true
    };
    // Accept direct deal object (widget style) or legacy options
    const deal = options.deal
      || (options.createDeal ? { Deal_Name: options.dealName || 'New Deal' } : null);
    if (deal)                payload.Deals    = deal;
    if (options.accountName) payload.Accounts = { Account_Name: options.accountName };
    if (options.contactId)   payload.Contacts = { id: options.contactId };

    const data = await _post(`/Leads/${leadId}/actions/convert`, { data: [payload] });
    return data.data?.[0] || {};
  }

  // ─── Tool: add_note ────────────────────────────────────────────────────────
  async function addNote(parentModule, parentId, noteTitle, noteContent, parentSearch) {
    // If caller only has the record name, search for the ID automatically (widget pattern)
    if (!parentId && parentSearch) {
      const res = await searchRecords(parentModule, parentSearch, [], 1, 1);
      const found = res.records?.[0];
      if (!found?.id) throw new Error(`No ${parentModule} record found matching "${parentSearch}"`);
      parentId = found.id;
    }
    if (!parentId) throw new Error('parent_id or parent_search is required');

    // Format confirmed from CRM widget crm-tools.js:
    //   Parent_Id: { id: "..." }  — object, not plain string
    //   se_module: "Leads"        — no $ prefix
    const noteData = {
      Note_Content: String(noteContent || ''),
      Parent_Id:    { id: String(parentId) },
      se_module:    parentModule
    };
    if (noteTitle && String(noteTitle).trim()) {
      noteData.Note_Title = String(noteTitle).trim();
    }

    const data   = await _post('/Notes', { data: [noteData] });
    const result = data.data?.[0];
    if (!result || result.code !== 'SUCCESS') {
      throw new Error(`Add note failed: ${result?.message || result?.status || JSON.stringify(data)}`);
    }
    return { id: result.details?.id, status: 'note_added' };
  }

  // ─── Tool: run_coql_query ──────────────────────────────────────────────────
  /**
   * Run a COQL (CRM Object Query Language) query.
   * Example: "SELECT Last_Name, Email FROM Leads WHERE Lead_Source = 'Web Site' LIMIT 5"
   */
  async function runCoqlQuery(query) {
    const data = await _post('/coql', { select_query: query });
    return {
      records: data.data  || [],
      info:    data.info  || {}
    };
  }

  // ─── Tool: get_current_user ────────────────────────────────────────────────
  async function getCurrentUser() {
    const data = await _get('/users', { type: 'CurrentUser' });
    return data.users?.[0] || null;
  }

  // ─── Unified tool executor ────────────────────────────────────────────────
  // Phase 3 (Gemini bridge) calls this with the function name + args
  // that Gemini returns in its function_call response.

  async function executeTool(toolName, args) {
    switch (toolName) {

      case 'list_modules':
        return listModules();

      case 'get_module_fields':
        return getModuleFields(args.module_name);

      case 'search_records':
        return searchRecords(
          args.module_name,
          args.search_term,
          args.fields,
          args.page,
          args.per_page
        );

      case 'get_record':
        return getRecord(args.module_name, args.record_id, args.fields);

      case 'create_record':
        return createRecord(args.module_name, args.record_data);

      case 'update_record':
        return updateRecord(args.module_name, args.record_id, args.record_data);

      case 'delete_record':
        return deleteRecord(args.module_name, args.record_id);

      case 'convert_lead':
        return convertLead(args.lead_id, args.options || { deal: args.deal });

      case 'add_note':
        return addNote(
          args.parent_module,
          args.parent_id,
          args.note_title,
          args.note_content,
          args.parent_search
        );

      case 'run_coql_query':
        return runCoqlQuery(args.query);

      case 'get_current_user':
        return getCurrentUser();

      default:
        throw new Error(`Unknown CRM tool: ${toolName}`);
    }
  }

  return {
    listModules, getModuleFields, searchRecords,
    getRecord, createRecord, updateRecord, deleteRecord,
    convertLead, addNote, runCoqlQuery, getCurrentUser,
    executeTool
  };
}

module.exports = { createCRMClient };
