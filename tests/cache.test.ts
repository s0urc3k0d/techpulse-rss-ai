import { describe, it, expect } from 'vitest';
import { LRUCache, generateCacheKey } from '../api/utils/cache';

describe('LRUCache', () => {
  it('should store and retrieve values', () => {
    const cache = new LRUCache<string>(3, 1000);
    
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for non-existent keys', () => {
    const cache = new LRUCache<string>(3, 1000);
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should evict oldest entry when max size reached', () => {
    const cache = new LRUCache<string>(2, 10000);
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3'); // Should evict key1
    
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
  });

  it('should expire entries after TTL', async () => {
    const cache = new LRUCache<string>(3, 50); // 50ms TTL
    
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 60));
    
    expect(cache.get('key1')).toBeNull();
  });

  it('should clear all entries', () => {
    const cache = new LRUCache<string>(3, 1000);
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    
    expect(cache.size()).toBe(0);
    expect(cache.get('key1')).toBeNull();
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent keys for same inputs', () => {
    const ids1 = ['a', 'b', 'c'];
    const ids2 = ['a', 'b', 'c'];
    
    expect(generateCacheKey(ids1)).toBe(generateCacheKey(ids2));
  });

  it('should generate same key regardless of order', () => {
    const ids1 = ['c', 'a', 'b'];
    const ids2 = ['a', 'b', 'c'];
    
    expect(generateCacheKey(ids1)).toBe(generateCacheKey(ids2));
  });

  it('should generate different keys for different inputs', () => {
    const ids1 = ['a', 'b', 'c'];
    const ids2 = ['x', 'y', 'z'];
    
    expect(generateCacheKey(ids1)).not.toBe(generateCacheKey(ids2));
  });
});
