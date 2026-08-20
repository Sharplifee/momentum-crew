# Momentum Crew

The crew's iOS app. A shell around the CRM at crm.momentumlandscapingut.com,
plus the background location that turns a phone being at a property into proof
the lawn was serviced.

## One sign-in, not two

The previous build had its own native login screen and then loaded the CRM,
which also asks you to sign in — the same system, twice, and two places for a
login bug to hide. There is no native login here. You sign in on the web, and
this shell reads that session to authorise the background location reports.

## It builds without a Mac

`.github/workflows/ios.yml` runs on GitHub's macOS runners. The signing
certificate, its private key and the provisioning profile are repository
secrets. Run it from the Actions tab, from any device.

Previously this app existed only in a folder on one laptop, which meant nothing
could be changed or shipped without that laptop.
