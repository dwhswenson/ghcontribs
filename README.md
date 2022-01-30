[![tests](https://github.com/dwhswenson/ghcontribs/actions/workflows/tests.yml/badge.svg)](https://github.com/dwhswenson/ghcontribs/actions/workflows/tests.yml)
[![Documentation Status](https://readthedocs.org/projects/ghcontribs/badge/?version=latest)](https://ghcontribs.readthedocs.io/en/latest/?badge=latest)
[![codecov](https://codecov.io/gh/dwhswenson/ghcontribs/branch/main/graph/badge.svg?token=NIDVFDmwvI)](https://codecov.io/gh/dwhswenson/ghcontribs)

# ghcontribs

Generate information about all GitHub contributions for a given user.

This was developed out of a desire to create a more detailed view of my own
contributions to open-source software, including tracking where I've
contributed PRs and where I've contributed bug report issues.

The requirements I had were:

* Get a list of Issues I've opened
* Get a list of Pull Requests I've opened

The goal was to gather data that could be presented as, e.g., a web page to
gives more information about my contributions, and perhaps allows me to
highlight a few aspects. This library allows you to store all your
contributions in a JSON file, and reload them to generate whatever output you
would like.

This library uses the GitHub GraphQL API (v4), with the thought that this might
be better future-proofed than the REST API (v3). Tested Python versions follow
[NEP29](https://numpy.org/neps/nep-0029-deprecation_policy.html).

### Installing

`ghcontribs` is distributed on PyPI, and can be installed through standard approaches using `pip` or `setuptools`. Recommended installation via `pip`:

```bash
python -m pip install ghcontribs
```

### Contributing

Contributions are most welcome. This was just written for my own needs; I hope
it is easy for other to extend it to meet their needs, too!

### Related work

I didn't find any existing tools that seemed to meet my goals (at least, not as
Python libraries), so I wrote my own. However, here are a few related tools
that I did find:

#### Very similar functionality

* [show-me](https://github.com/TomasTomecek/show-me):
  This has very similar functionality to what I have here, and may be better
  for many users. I didn't find `show-me` until I'd already created
  `ghcontribs`. It has slightly different ways of handling cached data, and I
  think the information I store from the GraphQL query is a little more useful
  for my interests.

#### Tools that only get the contribution graph

The contribution graph is a great way of illustrating a user's contributions
over a period of time, and filling those green squares is one of the things
that keeps me motivated as an open-source developer. However, it doesn't give
an easy way to provide an overview of how that user's contributions are split
by repository or organization.

* [github-contributions](https://github.com/garnertb/github-contributions):
  Uses web scraping to get the graph (not a guaranteed stable API); hasn't been
  updated since 2016 (as of late 2021).

#### Tools focused on per-repository contributions

For projects, especially large projects, it can be very useful to see where the
contributions to a specific repository come from. This is sort of a flip side
to my interest here, which is to look at a specific user's contributions to all
repositories.

* [git-fame](https://github.com/casperdcl/git-fame):
  Tool for listing contributions to a given repository; in many ways an
  improved version of `git blame` for counting contribution history. Very
  useful (my go-to for estimating per-user code contributions to a given repo),
  but tracks code contributions (commits) only, not GitHub contributions such
  as issues/pull requests.
* [octohatrack](https://github.com/LABHR/octohatrack):
  Obtain detailed contribution reports for a given repository. Whereas
  `git-fame` is great for commits, `octohatrack` is great GitHub-specific
  contributions like issues and reviews.

#### Tools focused on per-repository graph generation

These tools seem primarily focused on generating graphs from the GitHub data.

* [contrib](https://github.com/spack/contrib)
* [hercules / labours](https://github.com/src-d/hercules)
