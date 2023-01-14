# community-federated-search

This app is a prototype intended to power the federated search for the [Front Community](https://community.front.com). The final version of the app will run on a set interval and do the following:

* Retrieve documents from the sources we want to federate into the community search, such as Developer Portal docs
* Delete the current federated search index from the community
* Update the federated search index with the latest documents from the federated search sources

## API documentation

The script calls the following APIs:

* [Insided API](https://api2-eu-west-1.insided.com/docs/) (community)
* [Readme API](https://docs.readme.com/main/reference/intro/getting-started) (Developer Portal docs)

You can find specific API endpoint documentation noted as comments in the `src/scripts/federated_search.ts` script.
