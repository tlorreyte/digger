package iac_utils

import (
	"fmt"
	"sort"
	"strings"

	tfjson "github.com/hashicorp/terraform-json"
)

type PlanAction string

const (
	PlanActionCreate  PlanAction = "create"
	PlanActionUpdate  PlanAction = "update"
	PlanActionReplace PlanAction = "replace"
	PlanActionDelete  PlanAction = "delete"
)

var planActionOrder = map[PlanAction]int{
	PlanActionCreate:  0,
	PlanActionUpdate:  1,
	PlanActionReplace: 2,
	PlanActionDelete:  3,
}

type PlanResourceChange struct {
	Address string
	Action  PlanAction
}

// GetPlanResourceChanges returns the resource changes of a terraform plan json,
// skipping no-op and read actions, sorted by action then address.
func GetPlanResourceChanges(planJson string) ([]PlanResourceChange, error) {
	tfplan, err := parseTerraformPlanOutput(planJson)
	if err != nil {
		return nil, err
	}
	return planResourceChanges(tfplan), nil
}

func planResourceChanges(tfplan *tfjson.Plan) []PlanResourceChange {
	changes := make([]PlanResourceChange, 0, len(tfplan.ResourceChanges))
	for _, rc := range tfplan.ResourceChanges {
		if rc.Change == nil {
			continue
		}
		var action PlanAction
		switch actions := rc.Change.Actions; {
		case actions.Replace():
			action = PlanActionReplace
		case actions.Create():
			action = PlanActionCreate
		case actions.Update():
			action = PlanActionUpdate
		case actions.Delete():
			action = PlanActionDelete
		default:
			continue
		}
		changes = append(changes, PlanResourceChange{Address: rc.Address, Action: action})
	}
	sort.SliceStable(changes, func(i, j int) bool {
		if changes[i].Action != changes[j].Action {
			return planActionOrder[changes[i].Action] < planActionOrder[changes[j].Action]
		}
		return changes[i].Address < changes[j].Address
	})
	return changes
}

// CountPlanResourceChanges follows terraform's "N to add, M to change, K to destroy"
// semantics: a replace counts as one created and one destroyed.
func CountPlanResourceChanges(changes []PlanResourceChange) IacSummary {
	summary := IacSummary{}
	for _, c := range changes {
		switch c.Action {
		case PlanActionCreate:
			summary.ResourcesCreated++
		case PlanActionUpdate:
			summary.ResourcesUpdated++
		case PlanActionDelete:
			summary.ResourcesDeleted++
		case PlanActionReplace:
			summary.ResourcesCreated++
			summary.ResourcesDeleted++
		}
	}
	return summary
}

func RenderPlanSummary(changes []PlanResourceChange, markdown bool) string {
	counts := CountPlanResourceChanges(changes)
	headline := fmt.Sprintf("%d created, %d modified, %d destroyed", counts.ResourcesCreated, counts.ResourcesUpdated, counts.ResourcesDeleted)
	if markdown {
		headline = "**" + headline + "**"
	}
	var sb strings.Builder
	sb.WriteString(headline)
	if len(changes) > 0 {
		sb.WriteString("\n")
	}
	for _, c := range changes {
		if markdown {
			fmt.Fprintf(&sb, "\n- `%s` (%s)", c.Address, c.Action)
		} else {
			fmt.Fprintf(&sb, "\n- %s (%s)", c.Address, c.Action)
		}
	}
	return sb.String()
}
