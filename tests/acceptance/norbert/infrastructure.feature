@skip @infrastructure
Feature: Infrastructure -- CI Pipeline, Cross-Platform, and Installation

  As the Norbert development team,
  we need the CI pipeline, cross-platform compatibility, and installation process validated,
  so we can ship reliable releases on macOS, Linux, and Windows.

  # ===================================================================
  # Installation and Package Validation
  # ===================================================================

  Scenario: Global npm install produces working CLI entry point
    When Norbert is installed globally via npm
    Then the "norbert" command is available in the terminal
    And "norbert --version" prints the current version number

  Scenario: Dry-run initialization shows what would be configured
    Given Norbert is installed globally
    When Rafael runs initialization in dry-run mode
    Then Norbert displays what hooks would be added
    And displays where the database would be created
    And no files are actually created or modified

  # ===================================================================
  # Cross-Platform Smoke Tests
  # ===================================================================

  @cross_platform
  Scenario: Server starts and accepts events on macOS
    Given Norbert is installed on macOS
    When a test event is posted to the server
    Then the health check responds with healthy status
    And the event is stored in the database

  @cross_platform
  Scenario: Server starts and accepts events on Linux
    Given Norbert is installed on Linux
    When a test event is posted to the server
    Then the health check responds with healthy status
    And the event is stored in the database

  @cross_platform
  Scenario: Server starts and accepts events on Windows
    Given Norbert is installed on Windows
    When a test event is posted to the server
    Then the health check responds with healthy status
    And the event is stored in the database

  # ===================================================================
  # Architecture Boundary Enforcement
  # ===================================================================

  Scenario: Core package has zero runtime dependencies
    When the core package dependency list is inspected
    Then it contains no runtime dependencies
    And it imports nothing from other Norbert packages

  Scenario: Dashboard package has no Norbert runtime imports
    When the dashboard package dependency list is inspected
    Then it contains no runtime Norbert package dependencies
    And it communicates with the server exclusively through the network

  Scenario: No circular dependencies exist between packages
    When the package dependency graph is analyzed
    Then no circular dependency chains are found
    And all dependencies point inward toward core

  # ===================================================================
  # CI Pipeline Validation
  # ===================================================================

  Scenario: Linting and type checking pass on all packages
    When the lint and type check stages run
    Then all packages pass linting without errors
    And all packages pass type checking without errors

  Scenario: Unit test coverage meets threshold
    When unit tests run with coverage collection
    Then the core package coverage is at least 80%
    And the overall project coverage is at least 70%

  Scenario: Build produces valid package output
    When all packages are built
    Then no test files are included in the production package
    And the CLI entry point resolves correctly in the built output

  # ===================================================================
  # Database and Configuration
  # ===================================================================

  @error
  Scenario: Database corruption detected with recovery guidance
    Given the Norbert database becomes corrupted
    When Rafael checks the observatory status
    Then Norbert detects the corruption
    And suggests repair or reset options
    And existing data is backed up before any repair attempt

  Scenario: Configuration changes take effect on server restart
    Given Norbert is configured with default port 7890
    When the port is changed to 7891 in the configuration
    And the server is restarted
    Then the server listens on the new port 7891
    And the dashboard is accessible on the new port

  # ===================================================================
  # Security
  # ===================================================================

  Scenario: Server binds to localhost only
    Given the Norbert server is running
    When a connection attempt arrives from an external network address
    Then the connection is refused
    And only connections from 127.0.0.1 are accepted

  @error
  Scenario: Dependency audit finds no critical vulnerabilities
    When a security audit runs against all dependencies
    Then no critical severity vulnerabilities are found

  # ===================================================================
  # Data Retention
  # ===================================================================

  Scenario: Default retention purges old data automatically
    Given the retention period is configured to 30 days
    And sessions older than 30 days exist in the database
    When the retention cleanup runs
    Then sessions older than 30 days are removed
    And recent sessions within the retention window are preserved

  @property
  Scenario: Hook processing never blocks Claude Code tool execution
    Given Norbert hooks are configured for a Claude Code session
    When any hook fires during a tool call
    Then the hook returns within 50 milliseconds
    And Claude Code tool execution is never blocked waiting for Norbert
