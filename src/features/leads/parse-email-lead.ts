export type ParsedLeadFromEmail = {
  source: "email";
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
  estimate_notes: string;
  estimated_value: number;
};

export type LeadParseClient = {
  company_name: string;
  contact_name?: string;
  email?: string;
};

export type LeadParseCatalogItem = {
  sku: string;
  name: string;
  description?: string;
};

export type LeadParseContext = {
  clients?: LeadParseClient[];
  catalog?: LeadParseCatalogItem[];
};

const EMAIL_RE =
  /(?:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/gi;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:\s*(?:ext|x|extension)\.?\s*\d+)?/gi;
const MONEY_RE =
  /(?:£|€|\$|AUD\s?|USD\s?|NZD\s?)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)\s*(?:AUD|USD|NZD|GBP)?/gi;

const SELF_COMPANY_RE = /\brigging\s+rentals?\b/i;
const GREETING_OPEN_RE = /^(hi|hello|hey|dear)\b/i;
const SIGN_OFF_RE =
  /^(best regards|kind regards|warm regards|regards|thanks|thank you|cheers|sincerely|many thanks)[,!]?\s*$/i;
const GENERIC_ADDRESSEE_RE =
  /^(there|team|sir|madam|all|folks|everyone|hire|rentals?)$/i;
const JOB_TITLE_RE =
  /\b(director|manager|coordinator|engineer|supervisor|superintendent|procurement|buyer|estimator|operations|project|site|plant|fleet|logistics|admin|accountant|ceo|cfo|coo|owner|principal|partner|lead|foreman|consultant)\b/i;
const COMPANY_SUFFIX_RE =
  /\b(pty|ltd|limited|inc|llc|plc|co|company|corp|corporation|group|holdings|industries|solutions|technologies|technology|infotech|services|systems|construction|constructors|contractors|contracting|engineering|electrical|mechanical|civil|mining|hire|rentals?|logistics|earthmoving|scaffold|partners|associates|jv|trust|authority|council|pumping|tunneling|cranes?|solar|wind|marina|stadium|pipeline|landscapes?|facade|epc)\b/i;
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "live.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);
const KIT_HINT_RE =
  /\b(\d+\s*x|\d+\s*×|qty|quantity|need|hire|rent|days?|weeks?|months?|tonne|ton|hoist|winch|sling|shackle|spreader|gantry|cage|rigging|load\s*cell|tirfor|deliver|pickup|jobsite|site)\b/i;

type Scored = { value: string; score: number };

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function normalizeQuotes(text: string) {
  return text.replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D]/g, '"');
}

function stripQuoted(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.startsWith(">")) return false;
      if (/^On .+ wrote:$/i.test(t)) return false;
      if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(t)) return false;
      if (/^From:\s+/i.test(t) && /Sent:\s+/i.test(text)) return false;
      return true;
    })
    .join("\n");
}

function firstMatch(re: RegExp, text: string): string {
  re.lastIndex = 0;
  const m = text.match(re);
  return m?.[0]?.trim() ?? "";
}

function extractLabeled(text: string, labels: string[]): string {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  for (const label of labels) {
    const re = new RegExp(`^${label}\\s*[:\\-]\\s*(.+)$`, "i");
    for (const line of lines) {
      const m = line.match(re);
      if (m?.[1]) return m[1].trim();
    }
  }
  return "";
}

function stripGreetingPrefix(value: string): string {
  return value
    .replace(/^(hi|hello|hey|dear)\s+/i, "")
    .replace(/[,:;]+$/g, "")
    .trim();
}

function isSelfCompany(name: string): boolean {
  return SELF_COMPANY_RE.test(name) || /^(rigging\s+rentals?\s+team)$/i.test(name);
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      /^[A-Z0-9&.-]+$/.test(w) && w.length <= 4
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

export function normalizeOrgName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(pty|ltd|limited|inc|llc|plc|co|the|and|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

export function companySimilarity(a: string, b: string): number {
  const na = normalizeOrgName(a);
  const nb = normalizeOrgName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    return Math.max(0.86, shorter / longer);
  }
  const A = new Set(na.split(" ").filter((w) => w.length > 1));
  const B = new Set(nb.split(" ").filter((w) => w.length > 1));
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const dice = A.size && B.size ? (2 * inter) / (A.size + B.size) : 0;
  const dist = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
  return Math.max(dice, dist);
}

function isPlausiblePersonName(name: string): boolean {
  const t = name.trim().replace(/\s+/g, " ");
  if (!t || t.length > 60) return false;
  if (GREETING_OPEN_RE.test(t) || SIGN_OFF_RE.test(t) || isSelfCompany(t)) return false;
  if (JOB_TITLE_RE.test(t) || COMPANY_SUFFIX_RE.test(t)) return false;
  if (/[|@/]/.test(t)) return false;
  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/.test(t);
}

function looksLikeCompanyName(name: string): boolean {
  const t = stripGreetingPrefix(cleanLine(name));
  if (!t || t.length < 2 || t.length > 80) return false;
  if (isSelfCompany(t) || GENERIC_ADDRESSEE_RE.test(t)) return false;
  if (isPlausiblePersonName(t)) return false;
  if (COMPANY_SUFFIX_RE.test(t)) return true;
  if (/\b(and|&)\b/i.test(t) && t.split(/\s+/).length >= 2) return true;
  const words = t.split(/\s+/);
  if (words.length >= 2 && words.every((w) => /^[A-Z]/.test(w))) return true;
  return false;
}

export function sanitizeCompanyName(raw: string): string {
  let value = stripGreetingPrefix(cleanLine(raw));
  value = value.replace(/\s*\(from email\)\s*$/i, "").trim();
  if (!value || isSelfCompany(value) || GENERIC_ADDRESSEE_RE.test(value)) return "";
  if (/^hi\b/i.test(cleanLine(raw)) && /team$/i.test(value)) return "";
  if (/rentals?\s+team$/i.test(value)) return "";
  if (GREETING_OPEN_RE.test(value)) return "";
  return value;
}

export function sanitizeContactName(raw: string): string {
  const value = cleanLine(raw);
  if (!value || GREETING_OPEN_RE.test(value) || SIGN_OFF_RE.test(value)) return "";
  if (
    isSelfCompany(value) ||
    (JOB_TITLE_RE.test(value) && COMPANY_SUFFIX_RE.test(value))
  ) {
    return "";
  }
  if (looksLikeCompanyName(value) && !isPlausiblePersonName(value)) return "";
  return value;
}

function pickBest(items: Scored[], min = 55): string {
  const ranked = items
    .map((i) => ({ ...i, value: sanitizeCompanyName(i.value) || i.value }))
    .filter((i) => i.value && !isSelfCompany(i.value))
    .sort((a, b) => b.score - a.score);
  return ranked[0] && ranked[0].score >= min ? ranked[0].value : "";
}

function subjectLine(text: string): string {
  return (
    text.match(/^\s*subject\s*:\s*(.+)$/im)?.[1]?.trim() ??
    ""
  ).replace(/^(re|fw|fwd)\s*:\s*/i, "");
}

function signOffIndex(lines: string[]): number {
  return lines.findIndex((line) => SIGN_OFF_RE.test(line));
}

function companyFromTitleLine(line: string): string {
  const t = cleanLine(line);
  if (!t || t.length > 90) return "";
  const pipe = t.split(/\s*[|–—]\s*/);
  if (pipe.length >= 2) {
    const last = pipe[pipe.length - 1].trim();
    if (looksLikeCompanyName(last) || COMPANY_SUFFIX_RE.test(last)) return last;
  }
  if (JOB_TITLE_RE.test(t)) {
    const at = t.match(/\b(?:at|@)\s+(.+)$/i)?.[1]?.trim();
    if (at && looksLikeCompanyName(at)) return at.replace(/\s*[,.]$/, "");
    const comma = t.match(/^[^,]+,\s+(.+)$/)?.[1]?.trim();
    if (comma && looksLikeCompanyName(comma)) return comma;
  }
  return "";
}

function companiesFromAtPhrases(text: string): string[] {
  const out: string[] = [];
  const re =
    /\b(?:at|with|from)\s+([A-Z][A-Za-z0-9&.''-]*(?:\s+[A-Z][A-Za-z0-9&.''-]*){0,5})/g;
  for (const m of text.matchAll(re)) {
    const raw = (m[1] ?? "").replace(/[.,;:]+$/, "").trim();
    if (looksLikeCompanyName(raw) || COMPANY_SUFFIX_RE.test(raw)) out.push(raw);
  }
  return out;
}

function companyFromSubject(subject: string): string {
  if (!subject) return "";
  const parts = subject
    .split(/\s[-–—|:]\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (looksLikeCompanyName(last) || COMPANY_SUFFIX_RE.test(last)) return last;
  }
  const from = subject.match(/\bfrom\s+(.+)$/i)?.[1]?.trim();
  if (from && looksLikeCompanyName(from)) return from;
  return "";
}

function companyFromDomain(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain || FREE_MAIL.has(domain)) return "";
  const base = domain.split(".")[0] ?? "";
  if (!base || base.length < 3 || /rigging/.test(base)) return "";
  return titleCaseWords(base.replace(/[-_]/g, " "));
}

function bestClientMatch(
  candidate: string,
  clients: LeadParseClient[],
): LeadParseClient | null {
  let best: { client: LeadParseClient; score: number } | null = null;
  for (const c of clients) {
    const score = companySimilarity(candidate, c.company_name);
    if (!best || score > best.score) best = { client: c, score };
  }
  return best && best.score >= 0.84 ? best.client : null;
}

function contactFromSignOff(lines: string[]): string {
  const idx = signOffIndex(lines);
  if (idx < 0) return "";
  for (let i = idx + 1; i < Math.min(lines.length, idx + 8); i++) {
    const line = lines[i];
    if (!line || GREETING_OPEN_RE.test(line)) continue;
    if (companyFromTitleLine(line)) continue;
    if (isPlausiblePersonName(line)) return line;
  }
  return "";
}

function contactFromIntro(text: string): string {
  const intro = text.match(
    /(?:my name is|this is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/,
  );
  if (intro?.[1] && isPlausiblePersonName(intro[1])) return intro[1];
  return "";
}

function extractMoney(text: string): number {
  const currency =
    /(?:£|€|\$|AUD\s?|USD\s?|NZD\s?|GBP\s?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi;
  let best = 0;
  for (const m of text.matchAll(currency)) {
    const n = Number((m[1] ?? "").replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 50 && n < 10_000_000 && n > best) best = n;
  }
  if (best > 0) return best;
  MONEY_RE.lastIndex = 0;
  for (const m of text.matchAll(MONEY_RE)) {
    const idx = m.index ?? 0;
    const around = text.slice(Math.max(0, idx - 2), idx + m[0].length + 8);
    if (/\b(kva|kw|day|days|week|weeks|month|t\b|tonne|ton)\b/i.test(around)) continue;
    const n = Number((m[1] ?? "").replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 100 && n < 10_000_000 && n > best) best = n;
  }
  return best;
}

function extractPhone(text: string): string {
  const labeled = extractLabeled(text, [
    "Phone",
    "Mobile",
    "Tel",
    "Telephone",
    "Call",
    "Contact number",
  ]);
  if (labeled) {
    const p = firstMatch(PHONE_RE, labeled);
    if (p && p.replace(/\D/g, "").length >= 8) return p;
  }
  PHONE_RE.lastIndex = 0;
  for (const m of text.matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) return m[0].trim();
  }
  return "";
}

function extractDuration(text: string): string {
  const m =
    text.match(/\b(\d+)\s*[- ]?\s*(day|days|week|weeks|month|months)\b/i) ??
    text.match(/\b(\d+)\s*[- ]\s*day\b/i);
  if (!m) return "";
  const n = m[1];
  const unit = (m[2] ?? "day").toLowerCase().replace(/s$/, "");
  return `${n} ${unit}${Number(n) === 1 ? "" : "s"}`;
}

function catalogHits(text: string, catalog: LeadParseCatalogItem[]): string[] {
  const hay = text.toLowerCase();
  const hits: string[] = [];
  for (const item of catalog) {
    const sku = item.sku.trim();
    const name = item.name.trim();
    if (sku.length >= 3 && hay.includes(sku.toLowerCase())) {
      hits.push(`${sku} ${name}`.trim());
      continue;
    }
    const tokens = name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4);
    if (tokens.length && tokens.every((t) => hay.includes(t))) {
      hits.push(`${sku} — ${name}`.trim());
    }
  }
  return [...new Set(hits)].slice(0, 8);
}

function extractEstimateNotes(
  text: string,
  catalog: LeadParseCatalogItem[],
): string {
  const bits: string[] = [];
  const duration = extractDuration(text);
  if (duration) bits.push(duration);
  const kva = text.match(/\b(\d+(?:\.\d+)?)\s*kva\b/i);
  if (kva) bits.push(`${kva[1]} kVA`);
  const tonne = text.match(/\b(\d+(?:\.\d+)?)\s*(?:t|tonne|ton)\b/i);
  if (tonne) bits.push(`${tonne[1]} t`);
  bits.push(...catalogHits(text, catalog));
  for (const m of text.matchAll(/\b(\d+)\s*[x×]\s+([A-Za-z][A-Za-z0-9 +/\-]{2,40})/gi)) {
    bits.push(`${m[1]}× ${cleanLine(m[2]).replace(/\s+for\b.*$/i, "")}`);
  }
  if (/\bgenerators?\b/i.test(text) && !bits.some((b) => /generator/i.test(b))) {
    bits.push("industrial generators");
  }
  const kitLines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(
      (line) =>
        line.length > 12 &&
        line.length < 160 &&
        KIT_HINT_RE.test(line) &&
        !/^subject\s*:/i.test(line) &&
        !GREETING_OPEN_RE.test(line) &&
        !SIGN_OFF_RE.test(line) &&
        !isSelfCompany(line),
    )
    .slice(0, 5);
  for (const line of kitLines) {
    if (!bits.some((b) => line.toLowerCase().includes(b.toLowerCase()))) {
      bits.push(line);
    }
  }
  return [...new Set(bits)].slice(0, 10).join("\n");
}

/** Heuristic parse of a pasted inquiry email into lead form fields. */
export function parseEmailLead(
  raw: string,
  ctx: LeadParseContext = {},
): ParsedLeadFromEmail {
  const text = stripQuoted(normalizeQuotes(raw)).trim();
  const lines = text.split(/\r?\n/).map(cleanLine);
  const subject = subjectLine(text);
  const clients = ctx.clients ?? [];
  const catalog = ctx.catalog ?? [];

  const fromLine =
    text.match(/^From:\s*(.+)$/im)?.[1]?.trim() ??
    text.match(/\bFrom:\s*([^\n<]+)<([^>]+)>/i)?.[0] ??
    "";
  const angle = fromLine.match(/([^<\n]+)<([^>]+)>/);
  const fromName = angle
    ? cleanLine(angle[1] ?? "").replace(/^"|"$/g, "")
    : "";
  const emails = [...text.matchAll(EMAIL_RE)].map((m) => m[0].toLowerCase());
  const email =
    (angle?.[2] ?? "").trim().toLowerCase() ||
    firstMatch(EMAIL_RE, fromLine).toLowerCase() ||
    emails.find((e) => !/(noreply|no-reply|donotreply)/i.test(e)) ||
    "";

  const companyCandidates: Scored[] = [];
  const labeledCompany = extractLabeled(text, [
    "Company",
    "Organisation",
    "Organization",
    "Business",
    "Client",
    "Account",
  ]);
  if (labeledCompany) companyCandidates.push({ value: labeledCompany, score: 100 });

  const subjCo = companyFromSubject(subject);
  if (subjCo) companyCandidates.push({ value: subjCo, score: 90 });

  const idx = signOffIndex(lines);
  const sigLines = idx >= 0 ? lines.slice(idx + 1, idx + 8) : lines.slice(-6);
  for (const line of sigLines) {
    const co = companyFromTitleLine(line);
    if (co) companyCandidates.push({ value: co, score: 96 });
    else if (looksLikeCompanyName(line) && COMPANY_SUFFIX_RE.test(line)) {
      companyCandidates.push({ value: line, score: 82 });
    }
  }

  for (const co of companiesFromAtPhrases(text)) {
    companyCandidates.push({ value: co, score: 92 });
  }

  const domainCo = companyFromDomain(email);
  if (domainCo) companyCandidates.push({ value: domainCo, score: 74 });

  if (fromName && looksLikeCompanyName(fromName) && !isPlausiblePersonName(fromName)) {
    companyCandidates.push({ value: fromName, score: 70 });
  }

  let company = sanitizeCompanyName(pickBest(companyCandidates, 70));
  const matchedClient = company ? bestClientMatch(company, clients) : null;
  if (matchedClient) company = matchedClient.company_name;
  if (!company) {
    for (const c of companyCandidates) {
      const hit = bestClientMatch(c.value, clients);
      if (hit) {
        company = hit.company_name;
        break;
      }
    }
  }

  const contactCandidates: Scored[] = [];
  const labeledContact = extractLabeled(text, ["Contact", "Name", "Attn", "Attention"]);
  if (labeledContact && isPlausiblePersonName(labeledContact)) {
    contactCandidates.push({ value: labeledContact, score: 100 });
  }
  const signed = contactFromSignOff(lines);
  if (signed) contactCandidates.push({ value: signed, score: 95 });
  if (fromName && isPlausiblePersonName(fromName)) {
    contactCandidates.push({ value: fromName, score: 88 });
  }
  const intro = contactFromIntro(text);
  if (intro) contactCandidates.push({ value: intro, score: 80 });
  if (matchedClient?.contact_name && isPlausiblePersonName(matchedClient.contact_name)) {
    contactCandidates.push({ value: matchedClient.contact_name, score: 60 });
  }

  const contact = sanitizeContactName(pickBest(contactCandidates, 60));

  return {
    source: "email",
    company_name: company,
    contact_name: contact && contact !== company ? contact : sanitizeContactName(signed || fromName),
    email,
    phone: extractPhone(text),
    notes: text.slice(0, 4000),
    estimate_notes: extractEstimateNotes(text, catalog),
    estimated_value: extractMoney(text),
  };
}
