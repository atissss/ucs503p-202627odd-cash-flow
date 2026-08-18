Intrinsic: A DCF Valuation & Scenario-Analysis Platform

Project Proposal for UCS503P

Submitted to: Ms. Nisha Thakur

Thapar Institute of Engineering and Technology

Bhavin Bhatti, 1024030811
Bhoomi Mittal, 1024030814
Aatish Kumar Sahu, 1024030790

1  Higher-order goal …secondary framing

This project aims to improve financial decision-making transparency by making company valuation an interactive, auditable, and repeatable process rather than an opaque spreadsheet exercise. While valuation theory is broad, the immediate engineering objective is to translate a standard discounted-cash-flow (DCF) methodology into a measurable, deployable software system that fetches real financial data, validates it, and lets a user save and compare valuation scenarios side by side.

2  Time-to-value …primary heuristic

Deliver a working core early: we prototype the full valuation workflow — input assumptions, compute intrinsic value, view results — and validate it within a short first iteration.

Prioritize fast feedback over completeness: weekly iterations with CI-backed testing keep release friction low and let the model logic be verified continuously against known worked examples.

Define success by what ships and measures: the first iteration delivers a testable valuation engine and a usable interface; later iterations layer on live data, persistence, and comparison.

3  Problem Statement

Estimating what a company is worth is a foundational task in finance, but the tools students and analysts typically reach for — manual spreadsheets — suffer from recurring problems:

Opacity: a spreadsheet shows a number but hides the logic; errors in a buried cell are hard to catch and the reasoning is not auditable.

No memory or reuse: each valuation is a one-off file; there is no structured way to save, organize, and revisit prior analyses.

Manual, error-prone data entry: financial figures are copied by hand from filings, introducing mistakes and making it tedious to value a new company.

No scenario comparison: analysts must reason about optimistic, base, and pessimistic cases, but comparing them means duplicating spreadsheets and eyeballing differences.

Why this matters (contextual relevance): a DCF is famously sensitive to its assumptions — small changes in discount rate or growth swing the result substantially — so a system that makes those assumptions explicit, validates inputs, and compares scenarios directly addresses the method’s biggest practical weakness.

4  Proposed Solution …Software Proposition

4.1  Overview

Build a web-based "valuation-to-comparison" system with the following components:

Assumption input interface: users set projected cash flows, growth rate, discount rate (WACC), and terminal growth, with live recalculation of intrinsic value.

Automated data retrieval: users enter a ticker symbol and the system fetches the company’s financials from an external finance API and auto-populates the model.

Input validation layer: fetched data is checked for missing, zero, or implausible values before use; problems are flagged and fall back to manual entry.

Scenario management: users save named valuation scenarios (e.g., Bull / Base / Bear), then load or delete them.

Comparison dashboard: saved scenarios are displayed side by side, diffing both assumptions and resulting valuations, with the valuation range highlighted.

4.2  Core workflow

User enters a ticker; the system fetches and validates the company’s financial data, or the user inputs assumptions manually.

The valuation engine computes year-by-year discounted cash flows, a terminal value, enterprise and equity value, and intrinsic value per share.

The user adjusts assumptions and observes the impact live, including a WACC-versus-growth sensitivity grid.

The user saves the analysis as a named scenario and compares it against other saved scenarios.

4.3  Operational constraints for an educational setting

Usability: responsive web design so the tool runs on low-to-mid range devices.

No research-grade algorithms: the focus is workflow, data handling, and system correctness — the financial math itself is standard and well-documented.

Deployability: built on common web hosting and a managed database so it can be deployed and demonstrated end to end.

5  Solution Approach …Engineering focus

This is an engineering course project, so the emphasis is on system architecture, data integration, and workflow correctness rather than novel algorithmic research. The DCF formulas are textbook; the engineering lies in everything built around them.

5.1  Valuation engine …deterministic and testable

The DCF computation is implemented as a pure, side-effect-free module: given a set of assumptions, it returns the full valuation with no dependence on UI or network.

This isolation makes it directly unit-testable against known worked examples, and keeps the financial logic in one auditable place.

Guardrails enforce domain constraints (e.g., terminal growth must remain below the discount rate, or the perpetuity diverges).

5.2  Web architecture …web-based solution

A typical 3-tier web architecture:

Frontend: responsive interface for entering assumptions, viewing the projection table, sensitivity grid, and scenario comparison.

Backend API: proxies the external finance API (keeping credentials server-side), runs validation, and exposes scenario save/load/delete endpoints.

Database: stores users, saved scenarios, their assumptions, and cached financial data.

5.3  External data integration …with caching and error handling

Financial data is retrieved from a third-party provider and transformed from the provider’s statement format into the model’s inputs.

Responses are cached with a time-to-live to respect API rate limits and avoid redundant calls — a deliberate freshness-versus-cost design decision.

Failure modes (invalid ticker, network error, missing fields) are handled gracefully rather than crashing, with clear user feedback.

5.4  CI/CD and fast delivery enabler

Automatically build and run the engine’s unit tests on every change.

Produce repeatable deployment artifacts to a staging environment.

Enable safe, frequent releases of incremental features.

6  Evaluation Criterion …measurable and attributable

Success is defined using measurable metrics tied to the core workflow.

6.1  Primary evaluation metric

Valuation correctness: agreement between the engine’s output and independently computed reference valuations.

Target: engine output matches hand-verified worked examples within a small numerical tolerance across a suite of test cases.

Attribution: measured automatically via the unit-test suite run in CI on every commit.

6.2  Secondary evaluation metrics

Data-fetch success rate: percentage of valid ticker lookups that successfully populate the model, and correct handling of invalid ones.

Validation coverage: proportion of malformed-data cases that are caught and surfaced rather than silently passed through.

Scenario reliability: saved scenarios reload with identical inputs and outputs (round-trip integrity).

User clarity: user-reported clarity of the valuation and comparison views on a simple 1–5 feedback question.

Reliability: availability of the staging deployment for lookup and computation during demonstration (target ≥ 99% during pilot window).

6.3  Pilot validation plan …high-level

Recruit 10–20 test users (students with basic finance familiarity) to run valuations and use the comparison view.

Collect task-completion and clarity feedback, and log any data-fetch or validation failures encountered.

Compare the engine’s outputs against reference valuations for a fixed set of well-known companies as a correctness baseline.

7  Scalability …with foresight

Scalable (theoretically): the system supports growth in saved scenarios and concurrent users by decoupling frontend and backend, paginating and indexing scenario queries, and using a stateless API design.

Operationally deployable (practically): the system runs on common web hosting with a managed database, platform-hosted deployment, and a CI/CD pipeline for staging and production.

8  Engine availability heuristic

A mature set of tooling and services is available to implement this as a web-based project:

Web framework for REST APIs and a reactive frontend.

Managed relational database for users and saved scenarios.

A free third-party financial-data API for company fundamentals.

A caching layer to manage rate limits.

Test framework for unit and integration tests.

CI runner and staging deployment target.

These mature components let us focus on workflow design, data handling, correctness, and measurement rather than inventing new infrastructure.

9  Project scope and deliverables …iteration-friendly

9.1  Initial deliverable …first iteration

Assumption input interface with live intrinsic-value calculation

Pure DCF valuation engine (projection, terminal value, per-share output)

Sensitivity grid (WACC × terminal growth)

Input guardrails and validation for manual entry

CI: build + engine unit tests + linting

CD to staging via a single command or pipeline job

9.2  Subsequent deliverables

Live financial-data retrieval by ticker, with transform, caching, and error handling

Scenario persistence: save, load, and delete named scenarios (backed by the database)

Side-by-side scenario comparison with assumption/output diffing and valuation-range summary

User accounts so scenarios are per-user

Improved filtering and indexed queries for scale readiness

10  Risks and mitigations

External API limitations: free-tier financial APIs can be incomplete or rate-limited; mitigate with caching, validation, and always-available manual override.

Data-quality ambiguity: provider figures can disagree; define the exact fields and transformations used up front and surface them to the user.

Scope creep: keep the DCF math standard and resist adding research-grade features; prioritize the workflow and system around it.

Operational issues in pilot: use staging early and ensure CI/CD produces repeatable deployments.

11  Summary

This project proposes a deployable web platform that turns company valuation from an opaque spreadsheet into an auditable, data-driven system. It meets the course criteria by emphasizing time-to-value through rapid iterations, implementing CI/CD for frequent safe releases, and using measurable evaluation criteria (especially valuation correctness verified in CI). It remains focused on engineering — data integration, validation, persistence, and comparison — rather than research-driven novelty. The financial calculation is deliberately standard; the software is the project.