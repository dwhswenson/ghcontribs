import pytest

from ghcontribs.tests.utils import assert_url

from ghcontribs.contrib import *

class TestContribType:
    @pytest.mark.parametrize('contrib_type', [ContribType.PULL,
                                              ContribType.ISSUE])
    def test_serialization_cycle(self, contrib_type):
        ser = contrib_type.serialize()
        deser = ContribType.deserialize(ser)
        reser = deser.serialize()
        redeser = ContribType.deserialize(reser)

        assert ser == reser
        assert contrib_type == deser == redeser


class TestGitHubContrib:
    def setup(self):
        self.contribs = {
            'pull': GitHubContrib(
                owner='openpathsampling',
                repo='openpathsampling',
                number=750,
                contrib_type=ContribType.PULL,
            ),
            'issue': GitHubContrib(
                owner='openpathsampling',
                repo='openpathsampling',
                number=1000,
                contrib_type=ContribType.ISSUE,
            ),
        }

    @pytest.mark.parametrize('contrib_type', ['pull', 'issue'])
    def test_url(self, contrib_type):
        OPS_BASE = "https://github.com/openpathsampling/openpathsampling/"
        contrib = self.contribs[contrib_type]
        expected = {
            'pull': OPS_BASE + "pull/750",
            'issue': OPS_BASE + "issues/1000"
        }[contrib_type]

        assert contrib.url == expected

    @pytest.mark.parametrize('contrib_type', ['pull', 'issue'])
    def test_url_integration(self, contrib_type):
        contrib = self.contribs[contrib_type]
        assert_url(contrib.url)

    @pytest.mark.parametrize('contrib_type', ['pull', 'issue', 'other'])
    def test_github_shortname(self, contrib_type):
        contribs = {
            'other': GitHubContrib(owner='owner', repo='repo', number=1,
                                   contrib_type=ContribType.ISSUE)
        }
        contribs.update(self.contribs)
        contrib = contribs[contrib_type]
        expected = {
            'pull': "openpathsampling/openpathsampling#750",
            "issue": "openpathsampling/openpathsampling#1000",
            "other": "owner/repo#1",
        }[contrib_type]
        assert contrib.github_shortname == expected

    @pytest.mark.parametrize('contrib_type', ['pull', 'issue'])
    def test_serialization_cycle(self, contrib_type):
        contrib = self.contribs[contrib_type]

        ser = contrib.to_dict()
        deser = GitHubContrib.from_dict(ser)
        reser = deser.to_dict()
        redeser = GitHubContrib.from_dict(reser)

        assert ser == reser
        assert deser == redeser == contrib
        pass
