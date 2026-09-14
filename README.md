# Pipeline CRM

A single-page CRM for tracking contacts, companies and deals through a sales pipeline. All data lives in the browser under one localStorage key (`pipeline-crm.v2`). The app starts as a clean slate: no sample data, every list empty until you add records. "Clear all data" in the sidebar wipes everything back to that state.

## Views

- **Dashboard**: open pipeline value, open deal count, won this month, contact count, deal value by stage, closing soonest, recent activity.
- **Contacts**: searchable and sortable table, filters by company and tag, detail drawer with deals and an activity timeline, add/edit modal with validation, delete with confirm.
- **Companies**: account cards with contact count and open pipeline, detail drawer listing contacts and deals.
- **Deals**: kanban board across Lead, Qualified, Proposal, Negotiation, Won and Lost with HTML5 drag-and-drop, per-column count and summed value, add/edit modal and a per-deal note log.

## Scripts

```
npm install
npm run dev     # local development
npm run build   # production build
npm start       # serve the build on $PORT (default 3000)
```

The deploy target is a Node app on port 3000, matching `nubo.toml`.
