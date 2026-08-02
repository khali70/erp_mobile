/**
 * Who built the app, as data rather than JSX.
 *
 * Kept as one exported constant so the credit line is edited in a single place
 * (name, title, contact links) without touching the component that renders it,
 * and so anything else that needs it later - an About route, a support email
 * template, an exported report footer - reads the same source.
 *
 * Localised fields are keyed by the two languages the app ships with; the
 * component falls back to `en` for any other locale.
 */
export type DeveloperLocale = 'ar' | 'en';

export type DeveloperContact = {
  /** Feather icon name for the row. */
  readonly icon: 'mail' | 'phone' | 'message-circle' | 'linkedin' | 'github' | 'globe';
  /** Shown to the user (the address itself, not a label). */
  readonly value: string;
  /** Opened with Linking.openURL when the row is tapped. */
  readonly url: string;
};

export type DeveloperInfo = {
  readonly name: Record<DeveloperLocale, string>;
  readonly title: Record<DeveloperLocale, string>;
  readonly contacts: readonly DeveloperContact[];
};

export const DEVELOPER_INFO: DeveloperInfo = {
  name: {
    ar: 'أحمد خليفة',
    en: 'Ahmed Khalifa',
  },
  title: {
    ar: 'مهندس برمجيات ',
    en: 'Senior Software Engineer - Mobile & Systems',
  },
  contacts: [
    {
      icon: 'mail',
      value: 'ahmed_khalifa_dev@icloud.com',
      url: 'mailto:ahmed_khalifa_dev@icloud.com',
    },
  ],
};

export function developerText(field: Record<DeveloperLocale, string>, language: string): string {
  return field[language.startsWith('ar') ? 'ar' : 'en'];
}
