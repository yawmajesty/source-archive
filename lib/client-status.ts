// Plain constants — deliberately not in the "use server" module alongside
// setClientStatus, for the same reason as lib/stages.ts: Next.js only permits
// async function exports from a server-action file, so a const exported there
// never reaches the client bundle. ClientStatusControl mapped over it and
// threw, which is why the Relationship control never appeared.

export const CLIENT_STATUSES = [
  { id: "onboarding", label: "Onboarding", hint: "Signed up, work not started." },
  { id: "active",     label: "Active",     hint: "Currently working with us." },
  { id: "inactive",   label: "Inactive",   hint: "No longer working with us. Their products and tasks drop out of the command centre; nothing is deleted." },
] as const;
