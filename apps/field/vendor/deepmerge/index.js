'use strict';
function isMergeableObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const type = Object.prototype.toString.call(value);
  if (type === '[object RegExp]' || type === '[object Date]') return false;
  const reactType = typeof Symbol === 'function' && Symbol.for ? Symbol.for('react.element') : 0xeac7;
  return value.$$typeof !== reactType;
}
function emptyTarget(val) {return Array.isArray(val) ? [] : {};}
function cloneUnlessOtherwiseSpecified(value, options) {return (options.clone !== false && options.isMergeableObject(value)) ? deepmerge(emptyTarget(value), value, options) : value;}
function defaultArrayMerge(target, source, options) {return target.concat(source).map(function(element) {return cloneUnlessOtherwiseSpecified(element, options)});}
function getMergeFunction(key, options) {if (!options.customMerge) return deepmerge; var customMerge = options.customMerge(key); return typeof customMerge === 'function' ? customMerge : deepmerge;}
function getEnumerableOwnPropertySymbols(target) {return Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(target).filter(function(symbol) {return Object.propertyIsEnumerable.call(target, symbol)}) : [];}
function getKeys(target) {return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target));}
function propertyIsOnObject(object, property) {try {return property in object;} catch(_) {return false;}}
function propertyIsUnsafe(target, key) {return propertyIsOnObject(target, key) && !(Object.hasOwnProperty.call(target, key) && Object.propertyIsEnumerable.call(target, key));}
function unsafeKey(key) {return typeof key === 'string' && (key === '__proto__' || key === 'constructor' || key === 'prototype');}
function mergeObject(target, source, options) {
  var destination = {};
  if (options.isMergeableObject(target)) {
    getKeys(target).forEach(function(key) {
      if (unsafeKey(key)) return;
      destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
    });
  }
  getKeys(source).forEach(function(key) {
    if (unsafeKey(key) || propertyIsUnsafe(target, key)) return;
    if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
    else destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
  });
  return destination;
}
function deepmerge(target, source, options) {
  options = options || {};
  options.arrayMerge = options.arrayMerge || defaultArrayMerge;
  options.isMergeableObject = options.isMergeableObject || isMergeableObject;
  options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
  var sourceIsArray = Array.isArray(source), targetIsArray = Array.isArray(target);
  if (sourceIsArray !== targetIsArray) return cloneUnlessOtherwiseSpecified(source, options);
  else if (sourceIsArray) return options.arrayMerge(target, source, options);
  return mergeObject(target, source, options);
}
deepmerge.all = function deepmergeAll(array, options) {if (!Array.isArray(array)) throw new Error('first argument should be an array'); return array.reduce(function(prev, next) {return deepmerge(prev, next, options)}, {});};
module.exports = deepmerge;
