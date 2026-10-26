---
'@uniaria/testing': patch
---

A real screen reader's `press()` and `type()` wait after each key until it stops speaking, so `spoken()` holds everything the key made it say, a live region read after the key's own speech included. VoiceOver runs with its hints off, so it no longer adds instructions for using it to what a scenario hears.
