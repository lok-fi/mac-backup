"""Pydantic models for the dashboard spec — the contract between the analyst
agent, the Catalyst data store, and the React renderer.

Kept deliberately simple (no `Any`, no unions) so Gemini structured output
(`output_schema`) produces a clean, valid JSON schema. The renderer coerces
value types at draw time."""

from typing import List, Optional
from pydantic import BaseModel, Field


class Measure(BaseModel):
    column: str
    agg: str = Field("sum", description="sum | avg | count | min | max")
    label: Optional[str] = None


class Value(BaseModel):
    column: str
    agg: str = Field("sum", description="sum | avg | count | min | max")


class FilterCond(BaseModel):
    column: str
    op: str = Field("=", description="= | != | > | < | >= | <= | in | contains")
    # value kept as string; the renderer coerces to number/date as needed.
    value: str = ""


class Sort(BaseModel):
    by: str
    dir: str = Field("desc", description="asc | desc")


class Panel(BaseModel):
    id: str
    type: str = Field(..., description="kpi | bar | line | area | pie | table | scatter")
    title: str
    table: Optional[str] = Field(None, description="source table/sheet name")
    dimension: Optional[str] = Field(None, description="group-by column (x-axis / categories)")
    measures: Optional[List[Measure]] = None
    value: Optional[Value] = Field(None, description="single aggregate, for kpi panels")
    filter: Optional[List[FilterCond]] = None
    sort: Optional[Sort] = None
    limit: Optional[int] = None
    width: str = Field("half", description="full | half | third")


class Page(BaseModel):
    id: str
    title: str
    panels: List[Panel]


class DashboardSpec(BaseModel):
    title: str
    pages: List[Page]


# ── Data Plan (analysis stage output) ────────────────────────────────────────
# The analysis agent's structured understanding of the uploaded data: what each
# table is, how to use it, and how to divide it into one or more dashboards.
class TablePlan(BaseModel):
    name: str
    role: str = Field("", description="what this table represents")
    grain: str = Field("", description="what a single row means")
    dimensions: List[str] = Field(default_factory=list)
    measures: List[Measure] = Field(default_factory=list)
    time_column: Optional[str] = None
    notes: Optional[str] = None


class DashboardPlan(BaseModel):
    id: str
    title: str
    summary: str = ""
    tables: List[str] = Field(default_factory=list, description="source tables this dashboard uses")
    pages: List[str] = Field(default_factory=list, description="suggested page titles / ideas")


class DataPlan(BaseModel):
    overview: str = ""
    tables: List[TablePlan] = Field(default_factory=list)
    relationships: List[str] = Field(default_factory=list)
    dashboards: List[DashboardPlan] = Field(default_factory=list)
