import {getLanguage, setLanguage, t} from '../src/i18n';
import {ro} from '../src/i18n/ro';

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

describe('i18n', () => {
  afterEach(() => setLanguage('en'));

  it('has a non-empty Romanian value with the same placeholders for every key', () => {
    Object.entries(ro).forEach(([key, value]) => {
      expect(value.trim()).not.toBe('');
      expect(placeholders(value)).toEqual(placeholders(key));
    });
  });

  it('fills placeholders', () => {
    expect(t('{count} exercises', {count: 3})).toBe('3 exercises');
    expect(t('Up next: {name}', {name: 'Plank'})).toBe('Up next: Plank');
    setLanguage('ro');
    expect(t('{count} exercises', {count: 3})).toBe('3 exerciții');
  });

  it('translates known keys in Romanian and falls back to English otherwise', () => {
    setLanguage('ro');
    expect(getLanguage()).toBe('ro');
    expect(t('Workouts')).toBe('Antrenamente');
    expect(t('Some text nobody translated')).toBe('Some text nobody translated');
  });

  it('leaves English untouched', () => {
    expect(t('Workouts')).toBe('Workouts');
  });
});
