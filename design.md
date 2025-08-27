# 🧭 Waypoint Framework — Minimum Open Source Spec (v0.1)

> A declarative, provider-agnostic, schema-driven framework for defining, validating, and redelivering project deliverables in a workflow DAG.

---

## 📘 1. Glossary of Terms

| Term | Description |
|------|-------------|
| **Waypoint** | A node in the workflow DAG. Represents a deliverable with defined input and output schemas. Inputs define edges of the DAG. |
| **Deliverable** | The data output of a waypoint. Must conform to its output schema. |
| **Generator** | A function that produces a deliverable from one or more upstream deliverables. |
| **Validator** | A one-way semantic edge between an ancestor and descendant waypoint, defining if the descendant still adheres to its ancestor. |
| **Schema Provider** | Abstraction for retrieving schema definitions (e.g., JSON Schema) |
| **Deliverable Provider** | Abstraction for retrieving and persisting deliverables |
| **Redelivery** | Re-executing a generator when a downstream deliverable fails validation against an updated ancestor |
| **Workflow** | A DAG of waypoints defining structure and dependencies of deliverables. Validators form a separate graph. |

---

## 🧩 2. Core Concepts

### 2.1 Waypoint Definition

```yaml
waypoints:
  - name: blog_post
    input_schema: schemas/blog_input.json
    output_schema: schemas/blog_output.json
    inputs: [user_research]
    generator: generators.gen_blog_post
```

### 2.2 Validator Definition

```yaml
validators:
  - name: validate_blog_against_user_research
    upstream: user_research
    downstream: blog_post
    function: validators.blog_adheres_to_user_research
```

---

## ⚙️ 3. Interfaces

### 3.1 `SchemaProvider`

```python
class SchemaProvider(ABC):
    def get(self, schema_id: str) -> dict:
        ...
```

### 3.2 `DeliverableProvider`

```python
class DeliverableProvider(ABC):
    def get(self, waypoint: str) -> Deliverable:
        ...

    def set(self, waypoint: str, deliverable: Deliverable) -> None:
        ...
```

### 3.3 `Generator`

```python
class Generator(ABC):
    def deliver(self, inputs: dict[str, dict]) -> dict:
        """Returns a deliverable output."""
```

### 3.4 `Validator`

```python
class Validator(ABC):
    def validate(self, ancestor_output: dict, descendant_output: dict) -> bool:
        ...
```

---

## 🧠 4. Workflow Execution Semantics

### 4.1 Delivering
- The `deliver()` function on a generator accepts a dictionary of upstream deliverable values, keyed by waypoint name.
- Outputs must conform to the output schema.

### 4.2 Validation Triggers
- When a deliverable changes, revalidation is triggered for all downstream validators.
- If a validator fails, the downstream waypoint is redelivered.
- Redelivery is never recursive unless subsequent validations also fail.

### 4.3 Schema Validation
- All deliverables are assumed to pass their own output schema validation.
- Input schema validation is the generator’s responsibility.

---

## 📁 5. Default File Format

```yaml
project/
├── waypoints.yaml
├── validators.yaml
├── schemas/
│   ├── user_research.json
│   └── blog_post.json
├── deliverables/
│   ├── user_research.yaml
│   └── blog_post.yaml
```

---

## 🚦 6. Compliance Requirements for Implementations

To be spec-compliant:
- You must implement `SchemaProvider` and `DeliverableProvider`.
- All Waypoints must specify both input and output schemas.
- All deliverables must pass output schema validation before use.
- Validators must take two schemas as input and return a boolean.
- Implementations must support a mechanism to deliver/redeliver based on validation failure.
- No implicit downstream redelivery—only based on failed validations.

---

## 🧪 7. Optional Extensions (Out of Scope for v0.1)

- GenAI prompt templating system
- Web-based DAG visualizer
- Git-aware DeliverableProvider
- Rich diff/diagnostics tooling
