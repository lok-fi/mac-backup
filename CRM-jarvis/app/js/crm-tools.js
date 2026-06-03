/* global ZOHO */
/**
 * CRM tool layer.
 *  - declarations  -> JSON schema sent to Gemini so it knows which tools exist.
 *  - handlers      -> actual implementations that call the ZOHO JS SDK.
 *  - WRITE_TOOLS   -> set of tool names that mutate data (used for confirmation gating).
 */
(function (global) {
  "use strict";

  const WRITE_TOOLS = new Set([
    "create_record",
    "update_record",
    "delete_record",
    "convert_lead",
    "add_note",
  ]);

  /** Tool declarations in Gemini's `functionDeclarations` format. */
  const declarations = [
    {
      name: "list_modules",
      description: "List all CRM modules available in this org (standard + custom). Returns api_name, display label and whether it is creatable/updatable.",
      parameters: { type: "OBJECT", properties: {}, required: [] },
    },
    {
      name: "get_module_fields",
      description: "Get the field schema for a module so you can pick the right field API names, picklist values, lookups and data types before creating or updating records. ALWAYS call this before writing to a module you have not seen this session.",
      parameters: {
        type: "OBJECT",
        properties: {
          module: { type: "STRING", description: "API name of the module, e.g. 'Leads', 'Deals', 'Contacts', or a custom module api_name." },
        },
        required: ["module"],
      },
    },
    {
      name: "search_records",
      description: "Search records in a module using Zoho CRM search criteria syntax. Use this for filtered lookups (by email, phone, field equals, etc.). Returns up to 200 records.",
      parameters: {
        type: "OBJECT",
        properties: {
          module: { type: "STRING", description: "Module api_name, e.g. 'Leads'." },
          criteria: { type: "STRING", description: "Criteria string, e.g. \"(Email:equals:john@demo.com)\" or \"((Stage:equals:Qualification)and(Amount:greater_than:10000))\". Leave empty to list recent records." },
          fields: { type: "ARRAY", items: { type: "STRING" }, description: "Optional list of field api_names to include in the response. If omitted, default fields are returned." },
          per_page: { type: "NUMBER", description: "Records per page, 1-200. Default 50." },
          page: { type: "NUMBER", description: "Page number (1-based). Default 1." },
        },
        required: ["module"],
      },
    },
    {
      name: "get_record",
      description: "Fetch one record by id.",
      parameters: {
        type: "OBJECT",
        properties: {
          module: { type: "STRING" },
          id: { type: "STRING", description: "Record id (numeric string)." },
        },
        required: ["module", "id"],
      },
    },
    {
      name: "create_record",
      description: "Create a new record. The `data` object should use field api_names as keys. For lookups, pass an object like { id: '123...' } or { name: 'Acme' }.",
      parameters: {
        type: "OBJECT",
        properties: {
          module: { type: "STRING" },
          data: { type: "OBJECT", description: "Field api_name -> value map. Required fields depend on module — call get_module_fields first if unsure." },
        },
        required: ["module", "data"],
      },
    },
    {
      name: "update_record",
      description: "Update an existing record. Pass only the fields you want to change.",
      parameters: {
        type: "OBJECT",
        properties: {
          module: { type: "STRING" },
          id: { type: "STRING" },
          data: { type: "OBJECT", description: "Field api_name -> new value map." },
        },
        required: ["module", "id", "data"],
      },
    },
    {
      name: "delete_record",
      description: "Delete a record by id. Destructive — confirm with the user first if there is any doubt.",
      parameters: {
        type: "OBJECT",
        properties: {
          module: { type: "STRING" },
          id: { type: "STRING" },
        },
        required: ["module", "id"],
      },
    },
    {
      name: "run_coql_query",
      description: "Run a COQL (CRM Object Query Language, SQL-like) SELECT query for analytics and complex filtering. COQL REQUIRES a WHERE clause — for an unfiltered query use `WHERE id != '0'`. Example: SELECT id, Full_Name, Email FROM Leads WHERE Lead_Source = 'Web' ORDER BY Created_Time DESC LIMIT 50. Only SELECT is allowed.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "COQL SELECT statement." },
        },
        required: ["query"],
      },
    },
    {
      name: "convert_lead",
      description: "Convert a lead into an Account, Contact and (optionally) a Deal.",
      parameters: {
        type: "OBJECT",
        properties: {
          lead_id: { type: "STRING" },
          deal: {
            type: "OBJECT",
            description: "Optional deal payload, e.g. { Deal_Name: 'Acme - Q3', Amount: 25000, Closing_Date: '2026-09-30', Stage: 'Qualification' }.",
            properties: {
              Deal_Name: { type: "STRING" },
              Amount: { type: "NUMBER" },
              Closing_Date: { type: "STRING" },
              Stage: { type: "STRING" },
            },
          },
        },
        required: ["lead_id"],
      },
    },
    {
      name: "add_note",
      description: "Attach a note to any CRM record (Lead, Deal, Contact, Account, custom module). This is a convenience wrapper around the Notes module — use this INSTEAD OF calling create_record on Notes manually, because Notes has a non-obvious schema (Note_Content + Parent_Id + se_module) that's easy to get wrong. If you only have the record's name/last_name/email, leave parent_id blank and pass `parent_search` — the tool will look it up.",
      parameters: {
        type: "OBJECT",
        properties: {
          parent_module: { type: "STRING", description: "Module the note belongs to, e.g. 'Leads', 'Deals', 'Contacts', or a custom module api_name." },
          parent_id:     { type: "STRING", description: "Record id of the parent. If you know it, pass it. Otherwise leave blank and provide parent_search." },
          parent_search: { type: "STRING", description: "Search term to find the parent (used only when parent_id is blank). E.g. for a lead named 'lok8' pass 'lok8'." },
          content:       { type: "STRING", description: "Note body text." },
          title:         { type: "STRING", description: "Optional short note title shown in CRM. Leave blank for content-only." },
        },
        required: ["parent_module", "content"],
      },
    },
    {
      name: "get_current_user",
      description: "Return information about the currently logged-in CRM user (id, name, email, role, timezone). Useful for 'assign to me', 'show my deals' etc.",
      parameters: { type: "OBJECT", properties: {}, required: [] },
    },
    {
      name: "set_preferred_name",
      description: "Persist the name the user wants to be called by. Use when the user says things like 'call me X', 'my name is X', 'I'm X'. Saved across sessions; future greetings and references use this name. Pass the bare name only, no honorifics.",
      parameters: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "The name to use, e.g. 'Pratik'." },
        },
        required: ["name"],
      },
    },
    {
      name: "remember_fact",
      description: "Save a durable fact about the user, their preferences, or working style. Use when the user shares something worth remembering across sessions (e.g. 'I prefer concise updates', 'I work mainly with healthcare clients', 'always notify John when a deal closes'). Do NOT use this for transient task state. The fact is added to the assistant's knowledge base which is included in every future system prompt.",
      parameters: {
        type: "OBJECT",
        properties: {
          fact: { type: "STRING", description: "The fact to remember, phrased in third person, e.g. 'User prefers concise updates'." },
        },
        required: ["fact"],
      },
    },
    {
      name: "forget_fact",
      description: "Remove a previously-remembered fact by its id. Use when the user says 'forget X' or corrects something you remembered wrong. To learn the available ids, the user can see them in Settings → Knowledge.",
      parameters: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
        },
        required: ["id"],
      },
    },
    {
      name: "show_table",
      description: "Render a clean table inline in the chat. Use this whenever the user asks to 'show', 'list', or 'compare' multiple records, or when you want to present search/COQL results visually rather than dumping JSON. Works in BOTH text and voice modes. Rows are passed as parallel arrays of strings positionally aligned with columns.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Table caption shown above, e.g. 'Top 5 leads created this week'." },
          columns: {
            type: "ARRAY",
            description: "Column definitions, left-to-right. Order MUST match each row's value order.",
            items: {
              type: "OBJECT",
              properties: {
                label:  { type: "STRING", description: "Header text shown to the user." },
                format: { type: "STRING", description: "Optional formatting: 'currency' | 'date' | 'number' | 'percent' | 'text'. Default text. Currency uses Indian short-form (L, Cr)." },
                align:  { type: "STRING", description: "Optional: 'left' | 'right' | 'center'. Defaults to right for numeric/currency formats." },
              },
              required: ["label"],
            },
          },
          rows: {
            type: "ARRAY",
            description: "Array of row objects. Each row has a `cells` array of strings — cells[N] goes under columns[N]. Use empty string for missing values.",
            items: {
              type: "OBJECT",
              properties: {
                cells: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  description: "Cell values, positionally aligned with columns.",
                },
              },
              required: ["cells"],
            },
          },
          currency_symbol: { type: "STRING", description: "Symbol for currency columns. Default '₹'." },
        },
        required: ["title", "columns", "rows"],
      },
    },
    {
      name: "show_chart",
      description: "Render a chart inline in the chat for analysis or comparison. Pick chart_type='bar' for category counts/totals, 'pie' or 'donut' for share-of-whole, 'line' for trends over time. Works in BOTH text and voice modes — use this aggressively whenever the user asks for analytics or asks 'how many X by Y'.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          chart_type: { type: "STRING", description: "'bar' | 'pie' | 'donut' | 'line'." },
          labels: { type: "ARRAY", items: { type: "STRING" }, description: "Category labels along the X axis (bar/line) or slice labels (pie/donut)." },
          values: { type: "ARRAY", items: { type: "NUMBER" }, description: "Single-series numeric values aligned with labels." },
          series: {
            type: "ARRAY",
            description: "Multi-series mode (bar/line only). Each series gets its own color. If provided, ignore top-level `values`.",
            items: {
              type: "OBJECT",
              properties: {
                label:  { type: "STRING" },
                values: { type: "ARRAY", items: { type: "NUMBER" } },
              },
              required: ["label", "values"],
            },
          },
          y_label: { type: "STRING", description: "Optional Y-axis caption." },
          currency_symbol: { type: "STRING", description: "If values are currency, e.g. '₹' or '$'." },
          format: { type: "STRING", description: "'number' | 'currency' | 'percent'. Default 'number'." },
        },
        required: ["title", "chart_type", "labels"],
      },
    },
    {
      name: "suggest_next_steps",
      description: "Show 1-3 clickable suggestion chips with a genuinely useful next action the user might want. Use this SPARINGLY — only when a real human colleague would naturally suggest a follow-up. Skip it when there's nothing meaningful to suggest (most of the time). Never suggest cosmetic, repetitive, or obvious next steps. Each chip's `prompt` is what the user will send back to you if they tap.",
      parameters: {
        type: "OBJECT",
        properties: {
          items: {
            type: "ARRAY",
            description: "1 to 3 suggestion chips. Each chip has a short label and the full prompt that runs if tapped.",
            items: {
              type: "OBJECT",
              properties: {
                label:  { type: "STRING", description: "Short chip label, 2-5 words, in the user's language." },
                prompt: { type: "STRING", description: "Full sentence that becomes the next user message if the chip is tapped, in the user's language." },
              },
              required: ["label", "prompt"],
            },
          },
        },
        required: ["items"],
      },
    },
    {
      name: "show_kpis",
      description: "Render a row of KPI cards (one big number each) inline in the chat. Use for executive summaries — open rate, pipeline value, count metrics, etc. 1 to 6 cards.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                label:   { type: "STRING" },
                value:   { type: "STRING", description: "Pre-formatted display value, e.g. '₹42.5L' or '147' or '63%'." },
                delta:   { type: "STRING", description: "Optional change indicator, e.g. '+12%' or '-3'. Color is auto from sign." },
                caption: { type: "STRING", description: "Optional tiny line under the value, e.g. 'vs last month'." },
              },
              required: ["label", "value"],
            },
          },
        },
        required: ["items"],
      },
    },
    {
      name: "request_user_input",
      description: "Show the user an inline form they can fill directly in chat. Use this WHENEVER you need additional information to create or update a record — DO NOT ask in plain text and wait for them to type values. Always: (1) call get_module_fields first so you know which fields are mandatory and which are optional; (2) pass ALL mandatory fields in required_fields (pre-filling 'value' with anything you already extracted from images / context); (3) pass the remaining writable fields in optional_fields so the user can add more via the '+ Add field' picker. The user submits the form and you receive a {ok:true, values:{...}} response. IMPORTANT: do not combine this call with create_record/update_record in the same round — call request_user_input alone, then on the next round use its result to call create_record/update_record.",
      parameters: {
        type: "OBJECT",
        properties: {
          module: { type: "STRING", description: "Module api_name." },
          operation: { type: "STRING", description: "'create' or 'update'." },
          record_id: { type: "STRING", description: "Record id, required when operation='update'." },
          title: { type: "STRING", description: "Form title shown to user, e.g. 'New Lead from business card'." },
          reason: { type: "STRING", description: "One short sentence explaining what you'll do with the data." },
          submit_label: { type: "STRING", description: "Custom submit button text, e.g. 'Create Lead'. Optional." },
          required_fields: {
            type: "ARRAY",
            description: "Fields the form will show by default. Always include the module's mandatory fields, plus any others you couldn't auto-extract.",
            items: {
              type: "OBJECT",
              properties: {
                api_name: { type: "STRING" },
                label:    { type: "STRING" },
                data_type:{ type: "STRING", description: "text, email, phone, integer, double, currency, boolean, date, datetime, picklist, multiselectpicklist, textarea, lookup" },
                value:    { type: "STRING", description: "Pre-filled value if you have one." },
                picklist_values: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["api_name", "label", "data_type"],
            },
          },
          optional_fields: {
            type: "ARRAY",
            description: "Other writable fields available via the '+ Add field' picker. Include every non-system non-readonly field in the module so the user has the full menu.",
            items: {
              type: "OBJECT",
              properties: {
                api_name: { type: "STRING" },
                label:    { type: "STRING" },
                data_type:{ type: "STRING" },
                picklist_values: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["api_name", "label", "data_type"],
            },
          },
        },
        required: ["module", "operation", "title", "required_fields"],
      },
    },
  ];

  // -------- helpers --------
  function ensureSdk() {
    if (typeof ZOHO === "undefined" || !ZOHO.CRM) {
      throw new Error("ZOHO CRM SDK not available. Are you running inside a CRM tab widget?");
    }
  }

  function ok(data) { return { ok: true, data }; }
  function fail(err) {
    const message = err && (err.message || err.code || err.details?.message) || String(err);
    return { ok: false, error: message, raw: err };
  }

  // -------- handlers --------
  const handlers = {
    async list_modules() {
      ensureSdk();
      try {
        const res = await ZOHO.CRM.META.getModules();
        const modules = (res?.modules || []).map((m) => ({
          api_name: m.api_name,
          plural_label: m.plural_label,
          singular_label: m.singular_label,
          creatable: m.creatable,
          editable: m.editable,
          deletable: m.deletable,
          generated_type: m.generated_type, // 'default' | 'custom' | 'linking' | 'subform'
        }));
        return ok({ modules });
      } catch (e) { return fail(e); }
    },

    async get_module_fields({ module }) {
      ensureSdk();
      try {
        const res = await ZOHO.CRM.META.getFields({ Entity: module });
        const fields = (res?.fields || []).map((f) => ({
          api_name: f.api_name,
          field_label: f.field_label,
          data_type: f.data_type,
          required: f.system_mandatory || f.required,
          read_only: f.read_only,
          length: f.length,
          pick_list_values: (f.pick_list_values || []).map((p) => p.actual_value),
          lookup: f.lookup ? { module: f.lookup?.module?.api_name } : null,
        }));
        return ok({ module, fields });
      } catch (e) { return fail(e); }
    },

    async search_records({ module, criteria, fields, per_page, page }) {
      ensureSdk();
      try {
        const params = { Entity: module };
        if (criteria && criteria.trim()) params.RecordID = undefined; // not used
        const opts = {};
        if (criteria && criteria.trim()) opts.criteria = criteria;
        if (fields && fields.length) opts.fields = fields.join(",");
        if (per_page) opts.per_page = Math.min(Math.max(per_page, 1), 200);
        if (page) opts.page = page;

        const res = criteria
          ? await ZOHO.CRM.API.searchRecord({ Entity: module, Type: "criteria", Query: criteria, ...opts })
          : await ZOHO.CRM.API.getAllRecords({ Entity: module, sort_order: "desc", per_page: opts.per_page || 50, page: opts.page || 1 });
        return ok({ records: res?.data || [], info: res?.info || null });
      } catch (e) { return fail(e); }
    },

    async get_record({ module, id }) {
      ensureSdk();
      try {
        const res = await ZOHO.CRM.API.getRecord({ Entity: module, RecordID: id });
        return ok({ record: res?.data?.[0] || null });
      } catch (e) { return fail(e); }
    },

    async create_record({ module, data }) {
      ensureSdk();
      try {
        const res = await ZOHO.CRM.API.insertRecord({ Entity: module, APIData: data, Trigger: ["workflow"] });
        const row = res?.data?.[0];
        if (row && row.code && row.code !== "SUCCESS") return fail(row);
        return ok({ id: row?.details?.id, result: row });
      } catch (e) { return fail(e); }
    },

    async update_record({ module, id, data }) {
      ensureSdk();
      try {
        const res = await ZOHO.CRM.API.updateRecord({ Entity: module, RecordID: id, APIData: data, Trigger: ["workflow"] });
        const row = res?.data?.[0];
        if (row && row.code && row.code !== "SUCCESS") return fail(row);
        return ok({ id: row?.details?.id, result: row });
      } catch (e) { return fail(e); }
    },

    async delete_record({ module, id }) {
      ensureSdk();
      try {
        const res = await ZOHO.CRM.API.deleteRecord({ Entity: module, RecordID: id });
        const row = res?.data?.[0];
        if (row && row.code && row.code !== "SUCCESS") return fail(row);
        return ok({ id, result: row });
      } catch (e) { return fail(e); }
    },

    async run_coql_query({ query }) {
      ensureSdk();
      if (!/^\s*select\b/i.test(query)) {
        return fail("Only SELECT statements are allowed.");
      }
      try {
        let res;
        if (typeof ZOHO.CRM.API.coql === "function") {
          res = await ZOHO.CRM.API.coql({ select_query: query });
        } else if (typeof ZOHO.CRM.API.coqlQuery === "function") {
          res = await ZOHO.CRM.API.coqlQuery({ select_query: query });
        } else {
          return fail("COQL not available in this SDK build. Use search_records with criteria instead.");
        }
        // COQL returns 400 "missing clause" when there is no WHERE — surface a usable hint to the model.
        if (res?.code === "INVALID_QUERY" || res?.message === "missing clause") {
          return fail({
            message: "COQL query is missing a clause. COQL requires a WHERE clause. Add e.g. WHERE id != '0' to match all rows, or use search_records instead.",
          });
        }
        return ok({ records: res?.data || [], info: res?.info || null });
      } catch (e) { return fail(e); }
    },

    async convert_lead({ lead_id, deal }) {
      ensureSdk();
      try {
        const payload = { overwrite: true, notify_lead_owner: true, notify_new_entity_owner: true };
        if (deal) payload.Deals = deal;
        const res = await ZOHO.CRM.API.convertLead({ RecordID: lead_id, APIData: payload });
        return ok({ result: res });
      } catch (e) { return fail(e); }
    },

    async add_note({ parent_module, parent_id, parent_search, content, title }) {
      ensureSdk();
      if (!parent_module) return fail("parent_module is required.");
      if (!content || !String(content).trim()) return fail("content (the note text) is required.");
      try {
        // Resolve parent by search if id wasn't supplied.
        if (!parent_id && parent_search) {
          const search = await ZOHO.CRM.API.searchRecord({
            Entity: parent_module,
            Type: "word",
            Query: parent_search,
          });
          const found = search?.data?.[0];
          if (!found?.id) {
            return fail(`No ${parent_module} record matched "${parent_search}". Provide a more specific name/email/id and try again.`);
          }
          parent_id = found.id;
        }
        if (!parent_id) {
          return fail("parent_id or parent_search is required to attach the note to a record.");
        }
        const data = {
          Note_Content: String(content),
          Parent_Id: { id: parent_id },
          se_module: parent_module,
        };
        if (title && String(title).trim()) data.Note_Title = String(title).trim();
        const res = await ZOHO.CRM.API.insertRecord({
          Entity: "Notes",
          APIData: data,
          Trigger: ["workflow"],
        });
        const row = res?.data?.[0];
        if (row && row.code && row.code !== "SUCCESS") return fail(row);
        return ok({
          note_id: row?.details?.id,
          parent_module,
          parent_id,
          result: row,
        });
      } catch (e) { return fail(e); }
    },

    async get_current_user() {
      ensureSdk();
      try {
        const res = await ZOHO.CRM.CONFIG.getCurrentUser();
        const u = res?.users?.[0] || res?.[0] || res;
        return ok({ user: u });
      } catch (e) { return fail(e); }
    },
  };

  // Tools handled entirely in the widget UI (not via the CRM SDK).
  const UI_TOOLS = new Set([
    "request_user_input",
    "set_preferred_name",
    "remember_fact",
    "forget_fact",
    "show_table",
    "show_chart",
    "show_kpis",
    "suggest_next_steps",
  ]);
  // UI tools that BLOCK waiting for user input. These can't run in voice mode.
  const INTERACTIVE_UI_TOOLS = new Set(["request_user_input"]);

  global.CRMTools = {
    declarations,
    handlers,
    WRITE_TOOLS,
    UI_TOOLS,
    INTERACTIVE_UI_TOOLS,
    isWrite(name) { return WRITE_TOOLS.has(name); },
    isUI(name) { return UI_TOOLS.has(name); },
    isInteractiveUI(name) { return INTERACTIVE_UI_TOOLS.has(name); },
    async call(name, args) {
      const fn = handlers[name];
      if (!fn) return { ok: false, error: `Unknown tool: ${name}` };
      try {
        return await fn(args || {});
      } catch (e) {
        return fail(e);
      }
    },
  };
})(window);
