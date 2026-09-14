// Realistic first-run sample data for the CRM.
const companySpecs = [
  ['Northwind Logistics', 'northwind.co', 'Logistics', '201-500'],
  ['Brightloom Health', 'brightloom.health', 'Healthcare', '51-200'],
  ['Cobalt Manufacturing', 'cobaltmfg.com', 'Manufacturing', '501-1000'],
  ['Harbor & Vale', 'harborvale.com', 'Professional services', '11-50'],
  ['Trellis Software', 'trellis.io', 'Software', '51-200'],
  ['Meridian Credit Union', 'meridiancu.org', 'Financial services', '201-500'],
  ['Pinecrest Schools', 'pinecrest.edu', 'Education', '201-500'],
  ['Juniper Retail Group', 'juniperretail.com', 'Retail', '1000+'],
  ['Atlas Field Services', 'atlasfield.com', 'Construction', '51-200'],
  ['Lumen Diagnostics', 'lumendx.com', 'Biotech', '11-50'],
  ['Kestrel Energy', 'kestrelenergy.com', 'Energy', '501-1000'],
  ['Saltbox Hospitality', 'saltbox.hotels', 'Hospitality', '201-500']
]

const contactSpecs = [
  ['Dana Whitfield', 'VP Operations', 0, ['champion', 'enterprise']],
  ['Marcus Reed', 'Fleet Manager', 0, ['technical']],
  ['Priya Raman', 'Director of Nursing', 1, ['champion']],
  ['Owen Castellanos', 'CFO', 1, ['economic buyer']],
  ['Hannah Boyd', 'Plant Manager', 2, ['technical']],
  ['Tobias Lindqvist', 'Head of Procurement', 2, ['economic buyer', 'enterprise']],
  ['Renee Alvarez', 'Managing Partner', 3, ['economic buyer']],
  ['Samuel Osei', 'Practice Lead', 3, []],
  ['Iris Nakamura', 'VP Engineering', 4, ['technical', 'champion']],
  ['Cole Brennan', 'Head of RevOps', 4, ['champion']],
  ['Beatrice Lyons', 'Chief Risk Officer', 5, ['economic buyer']],
  ['Andre Duval', 'Branch Operations', 5, []],
  ['Grace Merriman', 'Superintendent', 6, ['economic buyer']],
  ['Felix Okonjo', 'IT Director', 6, ['technical']],
  ['Naomi Sandoval', 'Director of Stores', 7, ['enterprise']],
  ['Peter Vance', 'Supply Chain Lead', 7, ['technical']],
  ['Lucia Ferrari', 'Operations Manager', 8, ['champion']],
  ['Derrick Hale', 'Safety Coordinator', 8, []],
  ['Sofia Petrova', 'Lab Director', 9, ['technical', 'champion']],
  ['Nathan Cole', 'Founder', 9, ['economic buyer']],
  ['Maya Kaplan', 'Grid Analytics Lead', 10, ['technical']],
  ['Russell Tanaka', 'VP Field Ops', 10, ['enterprise']],
  ['Ingrid Halvorsen', 'GM, East Region', 11, ['champion']],
  ['Julian Mbeki', 'Revenue Manager', 11, []],
  ['Claire Donnelly', 'Consultant', 3, ['influencer']]
]

const owners = ['Julian Rivera', 'Alex Chen', 'Morgan Diaz']

const dealSpecs = [
  ['Fleet telematics rollout', 0, 0, 84000, 'Negotiation', 14],
  ['Warehouse scanner refresh', 0, 1, 26500, 'Qualified', 38],
  ['Nurse scheduling platform', 1, 2, 61000, 'Proposal', 21],
  ['Patient billing add-on', 1, 3, 18500, 'Lead', 55],
  ['Line 4 sensor retrofit', 2, 4, 132000, 'Negotiation', 9],
  ['Procurement portal seats', 2, 5, 47000, 'Won', -12],
  ['Case management suite', 3, 6, 39000, 'Proposal', 26],
  ['Client portal pilot', 3, 7, 12000, 'Lost', -20],
  ['Platform team licences', 4, 8, 58000, 'Won', -5],
  ['RevOps analytics tier', 4, 9, 29500, 'Qualified', 33],
  ['Risk reporting module', 5, 10, 96000, 'Proposal', 17],
  ['Branch kiosk software', 5, 11, 22000, 'Lead', 60],
  ['District-wide device plan', 6, 12, 74500, 'Negotiation', 11],
  ['Campus network upgrade', 6, 13, 41000, 'Qualified', 44],
  ['Store ops rollout, 240 sites', 7, 14, 188000, 'Proposal', 29],
  ['Inventory forecasting', 7, 15, 53000, 'Lead', 72],
  ['Crew dispatch mobile', 8, 16, 34000, 'Qualified', 25],
  ['Lab LIMS integration', 9, 18, 67000, 'Won', -2]
]

const activitySpecs = [
  ['call', 'Walked through the telematics pilot scope. Dana wants a 30-day trial on 40 trucks before signing.', 'deal', 0, 3],
  ['email', 'Sent the revised MSA with the redlined liability clause.', 'deal', 0, 26],
  ['meeting', 'Onsite with the fleet team. Marcus flagged the scanner battery issue as the blocker.', 'contact', 1, 50],
  ['note', 'Budget confirmed for Q3. Procurement approval takes about two weeks.', 'deal', 2, 8],
  ['call', 'Priya asked for references from two comparable hospital systems.', 'contact', 2, 30],
  ['email', 'Owen requested a three-year TCO breakdown before the board meeting.', 'deal', 3, 72],
  ['meeting', 'Plant tour at Cobalt. Line 4 downtime is costing them roughly $9k a day.', 'deal', 4, 20],
  ['note', 'Tobias will run the RFP internally; we are the incumbent-favoured vendor.', 'contact', 5, 96],
  ['call', 'Closed the procurement portal renewal at 47k, signed same day.', 'deal', 5, 300],
  ['email', 'Renee forwarded our proposal to the partner committee.', 'deal', 6, 44],
  ['note', 'Client portal pilot lost to an in-house build. Revisit in six months.', 'deal', 7, 480],
  ['meeting', 'Kickoff with Iris and the platform team. 60 seats live on day one.', 'deal', 8, 120],
  ['call', 'Cole wants attribution reporting before expanding the RevOps tier.', 'deal', 9, 16],
  ['email', 'Sent the risk module security questionnaire back to Beatrice.', 'deal', 10, 5],
  ['note', 'Meridian is consolidating vendors, so the kiosk deal may fold into the risk contract.', 'contact', 10, 60],
  ['call', 'Andre confirmed 14 branches in the first wave.', 'contact', 11, 88],
  ['meeting', 'Board presentation went well. Grace expects a decision after the July session.', 'deal', 12, 10],
  ['email', 'Felix asked for the network topology diagram and the SSO setup guide.', 'deal', 13, 34],
  ['note', 'Juniper wants a phased rollout: 40 stores, then 200 if metrics hold.', 'deal', 14, 6],
  ['call', 'Naomi introduced us to the regional directors for store ops.', 'contact', 14, 70],
  ['email', 'Peter shared last year forecast accuracy numbers, 71% at SKU level.', 'deal', 15, 110],
  ['meeting', 'Ride-along with an Atlas crew. Dispatch app needs offline mode.', 'deal', 16, 40],
  ['note', 'Derrick is the safety sign-off, loop him in before the pilot.', 'contact', 17, 130],
  ['call', 'Sofia confirmed the LIMS integration passed validation testing.', 'deal', 17, 18],
  ['email', 'Nathan signed the Lumen order form, kickoff scheduled for the 12th.', 'contact', 19, 52],
  ['note', 'Maya is building an internal business case for grid analytics.', 'contact', 20, 150],
  ['call', 'Russell wants pricing for 400 field technicians.', 'contact', 21, 24],
  ['meeting', 'Property walkthrough with Ingrid at the East Region flagship.', 'contact', 22, 66],
  ['email', 'Julian M. asked about revenue-management API limits.', 'contact', 23, 190],
  ['note', 'Claire referred us into two more partner firms.', 'contact', 24, 210]
]

const firstNameOf = (name) => name.split(' ')[0].toLowerCase()
const lastNameOf = (name) => name.split(' ').slice(-1)[0].toLowerCase().replace(/[^a-z]/g, '')

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString()
}

function daysFromNow(d) {
  return new Date(Date.now() + d * 86400 * 1000).toISOString().slice(0, 10)
}

export function buildSeed() {
  const companies = companySpecs.map(([name, domain, industry, size], i) => ({
    id: 'co' + (i + 1),
    name,
    domain,
    industry,
    size
  }))

  const contacts = contactSpecs.map(([name, title, ci, tags], i) => ({
    id: 'ct' + (i + 1),
    name,
    title,
    email: firstNameOf(name) + '.' + lastNameOf(name) + '@' + companies[ci].domain,
    phone: '(415) 555-0' + String(100 + i).slice(-3),
    companyId: companies[ci].id,
    owner: owners[i % owners.length],
    tags,
    createdAt: hoursAgo(200 + i * 37)
  }))

  const deals = dealSpecs.map(([title, ci, cti, value, stage, closeIn], i) => ({
    id: 'dl' + (i + 1),
    title,
    companyId: companies[ci].id,
    contactId: contacts[cti].id,
    value,
    stage,
    closeDate: daysFromNow(closeIn),
    owner: owners[i % owners.length],
    notes: '',
    createdAt: hoursAgo(400 + i * 29)
  }))

  const activities = activitySpecs.map(([type, body, linkKind, idx, h], i) => ({
    id: 'ac' + (i + 1),
    type,
    body,
    contactId: linkKind === 'contact' ? contacts[idx].id : deals[idx].contactId,
    dealId: linkKind === 'deal' ? deals[idx].id : null,
    timestamp: hoursAgo(h)
  }))

  return { companies, contacts, deals, activities }
}
