# Shared code: do not edit here

These files are copies of the website's code in `../src`, so this server can run on its own.
Coupon rules and prices in here decide what customers are charged.

Change the original in the website repository, then from this folder's parent run:

```bash
npm run sync-shared
```

Commit the updated `shared/` folder and deploy the server and the website together.
`npm run check-shared` reports whether this copy still matches the website.
