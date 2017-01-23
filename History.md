
4.0.0 / 2017-01-23
==================

  * Added precommit hooks to lint and validate
  * fix all linting errors. removed join function
  * removed join
  * reorganized the way s3 objects are handled
  * implemented 'endPrefix', removed superfluous 'list' function
  * fixed encoding settings (inherit from s3 class). fixed some file names/comments.
  * bug fixes

3.0.4 / 2016-08-12
==================

  * added async modifier function

3.0.3 / 2016-07-21
==================

  * changed a showProgess property to a verbose property

3.0.2 / 2016-07-20
==================

  * Merge pull request #30 from littlstar/make-config-backwards-compatible
  * updated config so that you can use a real AWS config, wile making the old keys backwards compatible

3.0.1 / 2016-07-13
==================

  * renamed s3renity file (oops)

3.0.0 / 2016-07-13
==================

  * Merge pull request #29 from littlstar/fix-deferred-references
  * code refactoring, creates new request now (again) per batch
  * split out s3 wrapper to its own module
  * switched the rest of the deferred references to promises
  * big refactor

2.2.11 / 2016-06-20
===================

  * removed unnecessary try-catch blocks and custom error (better to use stack)

2.2.10 / 2016-06-20
===================

  * small update

2.2.9 / 2016-06-20
==================

  * fix bug with reverse

2.2.8 / 2016-06-19
==================

  * added reverse function to batch request

2.2.7 / 2016-06-19
==================

  * better error handling

2.2.6 / 2016-06-19
==================

  * removed unnecessary try-catch blocks
  * added limit function to batch request
  * Update README.md

2.2.5 / 2016-05-16
==================

  * Merge pull request #25 from littlstar/reverse-option
  * added option to reverse the order of the objects traversed in context

2.2.4 / 2016-05-12
==================

  * fixed incorrectly calling progress.tick() for show_progress
  * cleaned some promise code up

2.2.3 / 2016-05-05
==================

  * fixed error handling bug and tightened up some code

2.2.2 / 2016-04-28
==================

  * update readme whitespace and wording

2.2.1 / 2016-04-27
==================

  * Merge pull request #22 from littlstar/fix-edgecase-bug
  * changed default timeout from 1 second to 10 seconds
  * fix edgecase bug when operating over multiple of 1000 files

2.2.0 / 2016-04-26
==================

  * properly show batch progress with a progress bar. separate verbose from show_progress options
  * removed documentation, moving to README
