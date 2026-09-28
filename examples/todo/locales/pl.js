export default {
  app: {
    name: 'Zadania',
    tagline: 'Przykład imp',
    signOut: 'Wyloguj',
  },
  account: {
    open: 'Konto i ustawienia',
    title: 'Konto',
    language: 'Język',
    theme: 'Motyw',
  },
  signIn: {
    title: 'Logowanie',
    intro:
      'Każde imię i e-mail są dobre. Atrapa serwera blokuje tylko adres zaczynający się od locked@.',
    name: 'Imię',
    email: 'E-mail',
    submit: 'Zaloguj',
    locked: 'To konto jest zablokowane. Użyj innego adresu e-mail.',
    failed: 'Nie udało się zalogować. Spróbuj ponownie.',
  },
  todos: {
    title: 'Zadania',
    add: 'Dodaj',
    newTitle: 'Co trzeba zrobić?',
    priority: 'Priorytet',
    due: 'Termin',
    filter: 'Pokaż',
    all: 'Wszystkie',
    active: 'Otwarte',
    completed: 'Zrobione',
    listLabel: 'Zadania',
    progress: 'Zrobione: {done} z {total}',
    remaining: 'Otwarte: {count}',
    markDone: 'Oznacz "{title}" jako zrobione',
    delete: 'Usuń "{title}"',
    added: 'Dodano "{title}"',
    deleted: 'Usunięto "{title}"',
    clearCompleted: 'Usuń zrobione',
    cleared: 'Usunięto wszystkie zrobione zadania',
    dueOn: 'Termin: {date}',
    empty: 'Nic do zrobienia. Dodaj zadanie powyżej.',
    priorities: { low: 'Niski', normal: 'Zwykły', high: 'Wysoki' },
  },
  todo: {
    title: 'Tytuł',
    notes: 'Notatki',
    done: 'Zrobione',
    status: 'Stan',
    open: 'Otwarte',
    save: 'Zapisz',
    saved: 'Zapisano "{title}"',
    delete: 'Usuń',
    confirmTitle: 'Usunąć to zadanie?',
    confirmBody: '"{title}" zniknie na zawsze.',
    cancel: 'Anuluj',
    notFound: 'To zadanie nie istnieje',
    back: 'Wróć do listy',
    edit: 'Edytuj',
    noNotes: 'Brak notatek',
    history: 'Historia',
    events: {
      created: 'Utworzono',
      edited: 'Zmieniono',
      done: 'Oznaczono jako zrobione',
      reopened: 'Otwarto ponownie',
    },
  },
  about: {
    title: 'O tym przykładzie',
    body: `
Ta aplikacja to przegląd **imp**. Każdy ekran używa innej części:

- **mapa aplikacji** steruje routerem, nawigacją, ścieżką i tytułem strony
- **klient HTTP** z ponawianiem, limitem czasu i przechwytywaczem autoryzacji rozmawia z atrapą serwera
- **stan**, wartości **computed** i listy z kluczami aktualizują DOM w miejscu
- **tłumaczenia** przełączają całą aplikację między angielskim i polskim
- sekcja **Statystyki** to leniwie ładowany **obszar** z własnymi tłumaczeniami
- przycisk **Usuń zrobione** jest za **flagą funkcji**
`,
    report: 'Coś nie działa na tej stronie? Zgłoś to.',
  },
  appMap: {
    todos: { label: 'Zadania', description: 'Lista zadań' },
    stats: { label: 'Statystyki', description: 'Ile już zrobiono' },
    about: { label: 'O aplikacji', description: 'Co pokazuje ten przykład' },
  },
  imp: {
    state: { empty: 'Nic tu jeszcze nie ma' },
    form: {
      required: 'To pole jest wymagane',
      minLength: 'Wpisz co najmniej {min} znaki',
      pattern: 'Sprawdź format',
      optional: 'opcjonalne',
    },
    dialog: { close: 'Zamknij' },
    theme: {
      label: 'Motyw',
      system: 'Systemowy',
      light: 'Jasny',
      dark: 'Ciemny',
      current: 'Motyw: {theme}',
    },
    lang: { label: 'Język', current: 'Język: {language}' },
    shell: {
      nav: 'Nawigacja',
      section: 'Sekcja',
      more: 'Więcej',
      moreIn: 'Więcej w {section}',
      close: 'Zamknij',
      loading: 'Ładowanie',
    },
    breadcrumbs: { label: 'Ścieżka', change: 'Zmień {label}' },
    toast: { dismiss: 'Zamknij' },
    notifications: {
      label: 'Powiadomienia',
      empty: 'Brak powiadomień',
      markAllRead: 'Oznacz wszystkie jako przeczytane',
      clearAll: 'Wyczyść wszystko',
      labelUnread: 'Powiadomienia, nieprzeczytane: {count}',
    },
    datePicker: {
      choose: 'Wybierz datę',
      clear: 'Wyczyść datę',
      done: 'Gotowe',
    },
    bugReport: {
      trigger: 'Zgłoś problem',
      title: 'Zgłoś problem',
      comment: 'Co poszło nie tak?',
      send: 'Wyślij zgłoszenie',
      cancel: 'Anuluj',
      sent: 'Dziękujemy - zgłoszenie wysłane',
    },
  },
}
