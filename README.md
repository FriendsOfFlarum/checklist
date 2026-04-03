# FoF Checklists

![License](https://img.shields.io/badge/license-MIT-blue.svg) [![Latest Stable Version](https://img.shields.io/packagist/v/fof/checklist.svg)](https://packagist.org/packages/fof/checklist)

A [Flarum](http://flarum.org) extension. Checklists for Flarum! If you can edit posts with checklists, you can click them to toggle without having to open the edit composer.
Integrates particularly well with [FoF Rich Text Editor](https://discuss.flarum.org/d/38789) but does not require it.

This extension is the successor to the abandoned [`askvortsov/flarum-checklist`](https://github.com/askvortsov1/flarum-checklist) package. If you are migrating, replace `askvortsov/flarum-checklist` with `fof/checklist` in your `composer.json`.

![Screenshot](https://i.imgur.com/y2XFZhA.png)

### Syntax

```
- [ ] unchecked
- [x] checked
  - [ ] Works nested

---

1. [ ] Works with ordered lists
```

### Installation

Install with composer:

```sh
composer require fof/checklist:*
```

### Updating

```sh
composer update fof/checklist
```

### Links

- [Packagist](https://packagist.org/packages/fof/checklist)
- [Github](https://github.com/FriendsOfFlarum/checklist)
- [Discuss](https://discuss.flarum.org/d/xxx)
