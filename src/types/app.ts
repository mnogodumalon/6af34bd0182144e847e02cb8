// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Veranstaltungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    beschreibung?: string;
  };
}

export interface Interaktionen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    veranstaltung?: RecordUrl; // applookup -> URL zu 'Veranstaltungen' Record
    reihenfolge?: number;
    frage?: string;
    erlaeuterung?: string;
    vorprompt?: string;
    endprompt?: string;
    aktiv?: boolean;
  };
}

export interface Feedbacks {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    interaktion?: RecordUrl; // applookup -> URL zu 'Interaktionen' Record
    feedbacktext?: string;
    kuerzel?: string;
    absende_kennung?: string;
  };
}

export interface Zusammenfassungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    interaktion?: RecordUrl; // applookup -> URL zu 'Interaktionen' Record
    zusammenfassungstext?: string;
    ki_antwort?: string;
    erstellt_am?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export interface Abschlussbewertungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    veranstaltung?: RecordUrl; // applookup -> URL zu 'Veranstaltungen' Record
    kuerzel?: string;
    besonders_toll?: string;
    verbesserungen?: string;
    referenzstatement?: string;
    email?: string;
    einwilligung?: boolean;
  };
}

export const APP_IDS = {
  VERANSTALTUNGEN: '6af34bb42cd4a598890ee408',
  INTERAKTIONEN: '6af34bb99e853a31fbf82851',
  FEEDBACKS: '6af34bba050b5a6b459f6ec5',
  ZUSAMMENFASSUNGEN: '6af34bbb0c6e4695454b0824',
  ABSCHLUSSBEWERTUNGEN: '6af34bbb858dab5cd6b949c2',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'veranstaltungen': {
    'titel': 'string/text',
    'datum': 'date/datetimeminute',
    'beschreibung': 'string/textarea',
  },
  'interaktionen': {
    'veranstaltung': 'applookup/select',
    'reihenfolge': 'number',
    'frage': 'string/textarea',
    'erlaeuterung': 'string/textarea',
    'vorprompt': 'string/textarea',
    'endprompt': 'string/textarea',
    'aktiv': 'bool',
  },
  'feedbacks': {
    'interaktion': 'applookup/select',
    'feedbacktext': 'string/textarea',
    'kuerzel': 'string/text',
    'absende_kennung': 'string/text',
  },
  'zusammenfassungen': {
    'interaktion': 'applookup/select',
    'zusammenfassungstext': 'string/textarea',
    'ki_antwort': 'string/textarea',
    'erstellt_am': 'date/datetimeminute',
  },
  'abschlussbewertungen': {
    'veranstaltung': 'applookup/select',
    'kuerzel': 'string/text',
    'besonders_toll': 'string/textarea',
    'verbesserungen': 'string/textarea',
    'referenzstatement': 'string/textarea',
    'email': 'string/email',
    'einwilligung': 'bool',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateVeranstaltungen = StripLookup<Veranstaltungen['fields']>;
export type CreateInteraktionen = StripLookup<Interaktionen['fields']>;
export type CreateFeedbacks = StripLookup<Feedbacks['fields']>;
export type CreateZusammenfassungen = StripLookup<Zusammenfassungen['fields']>;
export type CreateAbschlussbewertungen = StripLookup<Abschlussbewertungen['fields']>;