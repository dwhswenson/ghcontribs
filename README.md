[![tests](https://github.com/dwhswenson/ghcontribs/actions/workflows/tests.yml/badge.svg)](https://github.com/dwhswenson/ghcontribs/actions/workflows/tests.yml)
[![Documentation Status](https://readthedocs.org/projects/ghcontribs/badge/?version=latest)](https://ghcontribs.readthedocs.io/en/latest/?badge=latest)
[![codecov](https://codecov.io/gh/dwhswenson/ghcontribs/branch/main/graph/badge.svg?token=NIDVFDmwvI)](https://codecov.io/gh/dwhswenson/ghcontribs)

# ghcontribs

Generate information about all GitHub contributions for a give user.

This was developed out of a desire to create a more detailed view of my own
contributions to open-source software, including tracking where I've
contributed PRs and where I've contributed bug report issues.

The requirements I had were:

* Get a list of Issues I've opened
* Get a list of Pull Requests I've opened

The goal is to build a web page that gives more information about my
contributions, and perhaps allows me to highlight a few aspects. This library
allows you to store all your contributions in a JSON file, and reload them to
generate whatever output you would like.

The tools I found with similar goals didn't seem to have been updated in a long
time.
