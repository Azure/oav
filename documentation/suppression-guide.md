# `OAV` Suppression guide

## Who is this document written for?

This document is written to assist any ARM developer submitting PRs to [Azure/azure-rest-api-specs](https://github.com/Azure/azure-rest-api-specs). It is intended to help these users quickly suppress Model (examples) and Semantic (specification)) analysis errors.

Users **should not** suppress on a whim. There should be a filed issue with an ETA set BEFORE suppression are approved. If an analysis error is coming from a tooling failure, users can unblock themselves freely. Rememember that these suppressions will also be reviewed!

However, just because a suppression mechanism is supported, does not mean that Model or Semantic validation errors should be allowed to slip through the cracks. Recall that these specifications are used **against all valid ARM requests flowing through front door** to validate that the request is formulated properly. Ignoring validation errors at the spec repo level CAN result in unexpected downstream validation errors **at runtime**. Take these issues seriously!

## Using your autorest `readme.md` to suppress

<explain suppression section and directive yml>

### Specific file, Generic Error suppression

### Specific file suppression 

### Generic Error Suppression (do not use)