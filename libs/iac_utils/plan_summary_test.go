package iac_utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

const planSummaryFixture = `{
  "format_version": "1.2",
  "terraform_version": "1.7.3",
  "resource_changes": [
    {"address": "null_resource.unchanged", "change": {"actions": ["no-op"]}},
    {"address": "data.aws_caller_identity.current", "change": {"actions": ["read"]}},
    {"address": "aws_s3_bucket.old", "change": {"actions": ["delete"]}},
    {"address": "aws_instance.web", "change": {"actions": ["delete", "create"]}},
    {"address": "aws_lb.front", "change": {"actions": ["create", "delete"]}},
    {"address": "aws_s3_bucket.logs", "change": {"actions": ["update"]}},
    {"address": "module.vpc.aws_subnet.b", "change": {"actions": ["create"]}},
    {"address": "module.vpc.aws_subnet.a", "change": {"actions": ["create"]}}
  ]
}`

func TestRenderPlanSummary(t *testing.T) {
	changes, err := GetPlanResourceChanges(planSummaryFixture)
	assert.NoError(t, err)

	tests := []struct {
		name     string
		changes  []PlanResourceChange
		markdown bool
		want     string
	}{
		{
			name:     "markdown",
			changes:  changes,
			markdown: true,
			want: "**4 created, 1 modified, 3 destroyed**\n" +
				"\n- `module.vpc.aws_subnet.a` (create)" +
				"\n- `module.vpc.aws_subnet.b` (create)" +
				"\n- `aws_s3_bucket.logs` (update)" +
				"\n- `aws_instance.web` (replace)" +
				"\n- `aws_lb.front` (replace)" +
				"\n- `aws_s3_bucket.old` (delete)",
		},
		{
			name:     "plain text",
			changes:  changes,
			markdown: false,
			want: "4 created, 1 modified, 3 destroyed\n" +
				"\n- module.vpc.aws_subnet.a (create)" +
				"\n- module.vpc.aws_subnet.b (create)" +
				"\n- aws_s3_bucket.logs (update)" +
				"\n- aws_instance.web (replace)" +
				"\n- aws_lb.front (replace)" +
				"\n- aws_s3_bucket.old (delete)",
		},
		{
			name:     "no changes",
			changes:  nil,
			markdown: true,
			want:     "**0 created, 0 modified, 0 destroyed**",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, RenderPlanSummary(tt.changes, tt.markdown))
		})
	}
}

func TestGetSummaryFromPlanJsonCountsReplaceAsCreateAndDelete(t *testing.T) {
	isEmpty, summary, err := TerraformUtils{}.GetSummaryFromPlanJson(planSummaryFixture)
	assert.NoError(t, err)
	assert.False(t, isEmpty)
	assert.Equal(t, IacSummary{ResourcesCreated: 4, ResourcesUpdated: 1, ResourcesDeleted: 3}, *summary)
}

func TestGetPlanResourceChangesRejectsPulumiPreview(t *testing.T) {
	_, err := GetPlanResourceChanges(`{"changeSummary": {"create": 1, "same": 0, "update": 0, "delete": 0}}`)
	assert.Error(t, err)
}
