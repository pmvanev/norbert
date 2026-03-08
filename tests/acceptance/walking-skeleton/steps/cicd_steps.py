"""
Step definitions for CI/CD Pipeline scenarios (US-WS-000).

Driving port: GitHub Actions workflow (build pipeline entry point).
These steps verify build, release, and installation outcomes.
"""
from pytest_bdd import given, when, then, parsers, scenarios

scenarios("../milestone-1-cicd-pipeline.feature")


# ---------------------------------------------------------------------------
# Given Steps
# ---------------------------------------------------------------------------


@given(parsers.parse('a developer pushes version tag "{tag}" to the repository'))
def developer_pushes_tag(tag):
    """Simulate or verify a git tag push triggers the build pipeline."""
    # Software-crafter implements: trigger or verify GitHub Actions workflow
    pass


@given(
    parsers.parse(
        'the release for "{tag}" is published with the Windows binary'
    )
)
def release_exists_with_binary(tag):
    """Verify the GitHub Release exists with expected artifacts."""
    pass


@given("a developer pushes a version tag with code that fails to compile")
def developer_pushes_broken_tag():
    """Simulate a tag push where the Rust code fails compilation."""
    pass


@given("a user is installing Norbert")
def user_installing_norbert():
    """Set up context for an installation attempt."""
    pass


@given("the network connection drops during binary download")
def network_drops_during_download():
    """Simulate network failure during postinstall binary download."""
    pass


# ---------------------------------------------------------------------------
# When Steps
# ---------------------------------------------------------------------------


@when("the build pipeline completes")
def build_pipeline_completes():
    """Wait for or verify GitHub Actions workflow completion."""
    pass


@when("a user runs the install command on Windows 11")
def user_runs_install_command():
    """Execute the npm install command and capture results."""
    pass


@when("the build pipeline runs")
def build_pipeline_runs():
    """Wait for the pipeline to finish (success or failure)."""
    pass


@when("the download fails")
def download_fails():
    """Trigger the download failure path."""
    pass


@when("the build pipeline produces the Windows binary")
def pipeline_produces_binary():
    """Wait for binary artifact production."""
    pass


# ---------------------------------------------------------------------------
# Then Steps
# ---------------------------------------------------------------------------


@then(parsers.parse('a release for "{tag}" is published'))
def release_is_published(tag):
    """Verify GitHub Release exists for the given tag."""
    # Software-crafter implements: gh api or GitHub client check
    pass


@then("the release contains the Windows binary package")
def release_contains_binary():
    """Verify the release has the platform-specific binary asset."""
    pass


@then("the correct binary is downloaded for their platform")
def correct_binary_downloaded():
    """Verify postinstall detected win32-x64 and downloaded correctly."""
    pass


@then("the binary is placed in the Norbert installation directory")
def binary_in_install_dir():
    """Verify binary extracted to ~/.norbert/bin/."""
    pass


@then('the "norbert-cc" command is available in their terminal')
def norbert_command_available():
    """Verify norbert-cc is on PATH and executable."""
    pass


@then("the pipeline fails with a visible error")
def pipeline_fails_visibly():
    """Verify the workflow reports failure clearly."""
    pass


@then("no release is published for that tag")
def no_release_published():
    """Verify no GitHub Release was created."""
    pass


@then("the user sees a clear error message about the network failure")
def user_sees_network_error():
    """Verify the error message is user-friendly."""
    pass


@then("no partial files remain in the installation directory")
def no_partial_files():
    """Verify cleanup of any partial downloads."""
    pass


@then("the user can retry the installation")
def user_can_retry():
    """Verify retry is possible without manual cleanup."""
    pass


@then("the binary package is under 15 megabytes")
def binary_under_size_target():
    """Verify the packaged binary meets the size target."""
    pass
