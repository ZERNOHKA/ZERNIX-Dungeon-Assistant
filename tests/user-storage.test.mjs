import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { defaultZernixUserBundle, loadZernixUserBundle } from '../src/lib/zernixUserStorage.ts';

afterEach(() => { delete globalThis.localStorage; });

function load(raw) {
  globalThis.localStorage = { getItem: () => JSON.stringify(raw) };
  return loadZernixUserBundle();
}

test('invalid profile fields fall back without discarding saved notes', () => {
  const bundle = load({
    profile: { displayName: 42, avatarDataUrl: {}, affiliation: ['invalid'] },
    notes: { campaign: { body: 'Keep this scene', updatedAt: 123 } },
  });
  assert.deepEqual(bundle.profile, defaultZernixUserBundle().profile);
  assert.equal(bundle.notes.campaign.body, 'Keep this scene');
  assert.doesNotThrow(() => bundle.profile.displayName.trim());
  assert.doesNotThrow(() => bundle.profile.affiliation.trim());
});

test('valid and intentionally empty profile fields survive reload', () => {
  const profile = { displayName: 'Мастер', avatarDataUrl: '', affiliation: '' };
  assert.deepEqual(load({ profile }).profile, profile);
});

test('legacy partial profiles retain defaults for missing fields', () => {
  assert.deepEqual(load({ profile: { displayName: 'Мастер' } }).profile, {
    ...defaultZernixUserBundle().profile, displayName: 'Мастер',
  });
});

test('unreadable storage and malformed JSON return a default bundle', () => {
  globalThis.localStorage = { getItem: () => { throw new Error('Storage blocked'); } };
  assert.deepEqual(loadZernixUserBundle(), defaultZernixUserBundle());
  globalThis.localStorage = { getItem: () => '{broken' };
  assert.deepEqual(loadZernixUserBundle(), defaultZernixUserBundle());
});
