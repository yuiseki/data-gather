# Data Gather

An data entry app builder.

## Developing

### Setting up Backend

1. Initialize your venv

```
 python3 -m venv venv
 source venv/bin/activate
```

2. Install all requirements

```
pip install -r requirements.txt
```

3. Create development database

```
yarn setup-database
yarn db-upgrade
```

**NOTE:** If you already created the database, you only need to run `yarn db-upgrade`

### Starting the API server

1. Activate your Python venv, if you haven't already:

```
source venv/bin/activate
```

2. Set the `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` environment variables in a `.env` or `.env.local` file. Follow the template given in `.env.sample`

3. Start the API server

```
yarn api
```

This starts the API server in http://localhost:8000

The server will reload automatically upon filestystem changes.

To view the API docs, open http://localhost:8000/docs

This is the API's swagger page where you can test endpoints.

### Starting Front-End

This is a basic create-react-app (CRA) application.

1. Install all requirements

```
yarn install
```

2. Run the app

```
yarn start
```

This runs the app in the development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser. The page will reload if you make edits.

### Updating models

If you update any server models (in `server/models`) it is likely that you'll need to update the frontend types or migrate the database. Ask yourself the following:

**Do your updates affect the frontend types in `src/models`?**

If yes, then run `yarn sync-types` to sync the frontend and backend services. Then watch for any TypeScript errors that can help you notice what types need to be updated. A good start is to go to the model in `src/models` and update the frontend type to match what you wrote in the backend.

**Do your updates require a database migration?**

If you are updating a model that gets written to the database then it's highly likely this will require a database migration.

1. Run `yarn db-migration "Short description of your migration"` to autogenerate a migration script.
2. Go to `migrations/versions` and open your new migration script. Alembic (our python db migration manager) tries to autogenerate the migration code. It's generally successful with simple migrations, like adding new columns, but it doesn't know what to do for more complicated migrations that involve editing an existing column.
3. Verify that your auto-generated migration script is correct. Otherwise manually update.
4. **IMPORTANT:** Remember to also implement a downgrade function. Your migration script should be written such that running upgrade, followed by downgrade, results in the original database without any loss of data.
5. When ready, run `yarn db-upgrade` to test your migration. Verify it works.
6. Run `yarn db-downgrade` to test the downgrade. Verify you didn't lose any data.

If everything is good then you're ready to commit this change and submit a PR!

## Other Scripts

### `yarn sync-types`

Whenever you update the API models in `server/models.py` or add a new endpoint to `server/api/views.py`, you should run `yarn sync-types` to autogenerate the TypeScript API (in `src/api`) so that our frontend's types are synced with the backend.

### `yarn db-migration`

This will autogenerate a migration script to update the database. Remember to always manually check and update the script because the autogenerated code is usually only correct for simple migrations. Also remember that your downgrade function should be correct too.

### `yarn db-upgrade`

Upgrades a database all the way to the latest version.

### `yarn db-downgrade`

Downgrades the database by a single version.

### `yarn test`

Launches the test runner in the interactive watch mode. See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

**TODO**: we need to implement tests. Currently this is a useless command.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.
