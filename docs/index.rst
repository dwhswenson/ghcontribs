.. ghcontribs documentation master file, created by
   sphinx-quickstart on Wed Nov 17 18:07:27 2021.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to ghcontribs's documentation!
======================================

``ghcontribs`` loads a user's issues, pull requests, reviews, and issue
comments through the GitHub GraphQL API. Contributions retain their creation
timestamps and relevant nested issue or pull-request data, and can be stored
as JSON for later analysis.

Using this will require creating your own `personal access token
<https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token>`_
for GitHub.

Monthly archives
----------------

Run the monthly exporter with::

   python -m ghcontribs.monthly USERNAME --output-directory contributions

Supply a token with ``--token`` or the ``GHCONTRIBS_TOKEN`` environment
variable. The exporter writes ``YYYY-MM.json`` files using UTC month
boundaries. Completed contribution years contain all twelve months; the
current year ends at the current UTC month. Months without contributions are
represented by an empty JSON array.

.. toctree::
   :maxdepth: 2
   :caption: Contents:

   api/index



Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
