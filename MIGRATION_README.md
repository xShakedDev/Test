# Migration to Numeric IDs

This migration converts MongoDB ObjectIDs to simple numeric IDs (1, 2, 3, etc.) for gates in the system.

## What This Migration Does

- Changes gate IDs from MongoDB ObjectIDs (e.g., `68a10fcd75d7bb09908ddb49`) to simple numbers (e.g., `1`, `2`, `3`)
- Updates all database models and routes to use numeric IDs
- Maintains data integrity and relationships
- Provides a clean, simple ID system for gates

## Before Migration

Gates had IDs like:
```
_id: ObjectID('68a10fcd75d7bb09908ddb49')
_id: ObjectID('68a10fcd75d7bb09908ddb50')
_id: ObjectID('68a10fcd75d7bb09908ddb51')
```

## After Migration

Gates will have IDs like:
```
id: 1
id: 2
id: 3
```

## How to Run the Migration

1. **Stop your application** to prevent any data changes during migration
2. **Run the migration script**:
   ```bash
   npm run migrate-to-numeric-ids
   ```
3. **Restart your application** with MongoDB enabled:
   ```bash
   npm run start:mongo
   ```

## What Gets Updated

### Database Models
- `Gate` model: Added `id` field, removed `_id` transformation
- `GateHistory` model: Changed `gateId` from ObjectID reference to Number
- `User` model: Changed `authorizedGates` from ObjectID references to Numbers

### API Routes
- All gate CRUD operations now use numeric IDs
- Gate opening, updating, and deletion use numeric IDs
- User management routes updated to handle numeric gate IDs

### Frontend
- No changes needed - the frontend already expects `id` field
- Gates will now display with simple numbers instead of long ObjectIDs

## Migration Process

The migration script:
1. Connects to your MongoDB database
2. Finds all existing gates
3. Assigns sequential numeric IDs starting from 1
4. Updates all gate records
5. Verifies the migration was successful

## Rollback

If you need to rollback:
1. The original `_id` fields are preserved in MongoDB
2. You can restore the old models and routes
3. Data integrity is maintained

## Benefits

- **Simpler IDs**: Easy to remember and reference
- **Better UX**: Users see simple numbers instead of long strings
- **Consistent**: All gates follow a predictable numbering pattern
- **Maintainable**: Easier to debug and manage

## Requirements

- MongoDB connection must be working
- Application must be stopped during migration
- Sufficient database permissions to update records

## Troubleshooting

If the migration fails:
1. Check your MongoDB connection string in `.env`
2. Ensure you have write permissions to the database
3. Check the console output for specific error messages
4. Verify no other processes are accessing the database

## Support

If you encounter issues during migration, check the console output for detailed error messages. The migration script includes comprehensive error handling and logging.
