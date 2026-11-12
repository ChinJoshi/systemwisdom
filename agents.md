Exclusively use shadcn components, you can bring them in as needed using the shadcn cli, refer to the shadcn docs as needed: https://ui.shadcn.com/docs

This app is called system wisdom and it's used to figure out which contributors to a codebase have understanding over what parts of the codebase.

Never apply db migrations yourself, you should only ever generate the migrations (by editing the sqlalchemy models and using alembic's autogenerate) 
