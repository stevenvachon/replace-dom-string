# replace-dom-string [![NPM Version][npm-image]][npm-url] ![File Size][filesize-image] [![Build Status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url]

> Replace one or more matching strings/regexes within a DOM tree.


## Installation

[Node.js](http://nodejs.org/) `>= 10` is required. To install, type this at the command line:
```shell
npm install replace-dom-string
```


## Usage

Import as an ES Module:
```js
import replaceDOMString from 'replace-dom-string';
```

Import as a CommonJS Module:
```js
const replaceDOMString = require('replace-dom-string');
```

Single needle/replacement with default options:
```js
const target = document.querySelector('elm');
// <elm attr="needle">needle</elm>

replaceDOMString('needle', 'replacement', target);
// <elm attr="replacement">replacement</elm>
```

Single needle/replacement with custom options:
```js
const target = document.querySelector('elm');
// <elm attr="needle">needle</elm>

replaceDOMString('needle', 'replacement', target, {characterData: false});
// <elm attr="replacement">needle</elm>
```

Multiple needles/replacements (including `RegExp`) and custom options:
```js
const target = document.querySelector('elm');
/*
<elm attr="foo bar001">
  foo bar001
  <nested attr="foo bar001">foo bar001</nested>
</elm>
*/

replaceDOMString(
  ['foo', /bar(\d+)/g],
  ['baz', 'baz$1'],
  target,
  {attributes: false}
);
/*
<elm attr="foo bar001">
  baz baz001
  <nested attr="foo bar001">baz baz001</nested>
</elm>
*/
```


## Options

At a minimum, one of `attributes` and/or `characterData` must be `true`; otherwise, a `TypeError` exception will be thrown. Inspired by [`MutationObserver`](https://mdn.io/MutationObserver).

### `acceptAttribute`
Type: `Function`  
Default value: `(attribute) => true`  
A custom filter that is performed for each attribute after the default filtering has deemed such worthy of changes. It must return a boolean.

### `acceptNode`
Type: `Function`  
Default value: `(node) => NodeFilter.FILTER_ACCEPT`  
A custom filter that is performed for each `ELEMENT_NODE` and `TEXT_NODE` after the default filtering has deemed such worthy of changes. It must return a [`NodeFilter.FILTER_*` constant](https://mdn.io/NodeFilter).

### `attributes`
Type: `Boolean`  
Default value: `true`  
When `true`, attribute *values* will be included in substitution.

### `characterData`
Type: `Boolean`  
Default value: `true`  
When `true`, [`Text` nodes](https://mdn.io/Text) within the child list of `target` will be included in substitution.

### `subtree`
Type: `Boolean`  
Default value: `true`  
When `true`, substitution will be extended to the entire subtree of nodes rooted at `target`.


## Compatibility

Depending on your target browsers, you may need polyfills/shims for the following:

* [`Array.from`](https://mdn.io/Array.from)
* [`Array::includes`](https://mdn.io/Array::includes)


[npm-image]: https://img.shields.io/npm/v/replace-dom-string.svg
[npm-url]: https://npmjs.com/package/replace-dom-string
[filesize-image]: https://img.shields.io/badge/size-1.8kB%20gzipped-blue.svg
[travis-image]: https://img.shields.io/travis/stevenvachon/replace-dom-string.svg
[travis-url]: https://travis-ci.org/stevenvachon/replace-dom-string
[coveralls-image]: https://img.shields.io/coveralls/stevenvachon/replace-dom-string.svg
[coveralls-url]: https://coveralls.io/github/stevenvachon/replace-dom-string
