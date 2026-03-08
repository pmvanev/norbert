Feature: CI/CD Pipeline -- Build, package, and distribute Norbert
  As a developer building Norbert,
  I want automated builds that produce installable binaries on version tags,
  so that every release is reproducible and users can install with a single command.

  Scenario: Tagged commit produces a downloadable release
    Given a developer pushes version tag "v0.1.0" to the repository
    When the build pipeline completes
    Then a release for "v0.1.0" is published
    And the release contains the Windows binary package

  @skip
  Scenario: User installs Norbert with a single command
    Given the release for "v0.1.0" is published with the Windows binary
    When a user runs the install command on Windows 11
    Then the correct binary is downloaded for their platform
    And the binary is placed in the Norbert installation directory
    And the "norbert-cc" command is available in their terminal

  Scenario: Build failure prevents release publication
    Given a developer pushes a version tag with code that fails to compile
    When the build pipeline runs
    Then the pipeline fails with a visible error
    And no release is published for that tag

  @skip
  Scenario: Install fails gracefully on network error
    Given a user is installing Norbert
    And the network connection drops during binary download
    When the download fails
    Then the user sees a clear error message about the network failure
    And no partial files remain in the installation directory
    And the user can retry the installation

  @skip
  Scenario: Pipeline produces binary under size target
    Given a developer pushes version tag "v0.1.0"
    When the build pipeline produces the Windows binary
    Then the binary package is under 15 megabytes
