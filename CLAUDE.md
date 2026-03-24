- memorize current state of the Analytics component
- Any time the quotes functionality is updated, ensure the audit trail piece is always updated as well.

## Production Push Steps

Follow these steps any time a new feature is added or existing features are modified:

1. **Run Type Check** - `npx tsc --noEmit` to catch TypeScript errors
2. **Run Linter** - `npm run lint` to ensure code quality
3. **Run Tests** - `npm test` to verify functionality
4. **Build Locally** - `npm run build` to catch build-time errors
5. **Database Migration** (if schema changed) - `npx prisma migrate dev` then `npx prisma generate`
6. **Test in Development** - Verify the feature works as expected locally
7. **Commit Changes** - Use descriptive commit messages
8. **Push to Remote** - `git push origin <branch>`
9. **Create PR** (if on feature branch) - Include summary and test plan
10. **Deploy** - Follow deployment pipeline (Docker build + Caddy)
11. **Verify in Production** - Smoke test the deployed changes

## SanMar API Integration Plan (Status: Phase 1 Complete)

### Overview
- **API Type:** SOAP/XML (SanMar Standard + PromoStandards)
- **Image Strategy:** Remote CDN references (https://cdnm.sanmar.com/) - no GCS upload needed
- **Sync Method:** Bulk initial load + daily delta updates

### Implementation Phases

#### Phase 1: Database Schema & Core Infrastructure
- [x] 1.1 Schema Updates - SanMarSyncConfig, SanMarSyncLog models, Product SanMar fields
- [x] 1.2 SOAP Client Service - src/lib/sanmar/soap-client.ts

#### Phase 2: Data Sync Engine
- [ ] 2.1 Sync Service Architecture - product-sync, category-mapper, supplier-mapper, image-resolver
- [ ] 2.2 Category Mapping - Map 16 SanMar categories to local structure
- [ ] 2.3 Supplier/Brand Mapping - Auto-create Supplier records from brands

#### Phase 3: Sync Jobs & Scheduling
- [ ] 3.1 Admin API Routes - /api/admin/sanmar/* endpoints
- [ ] 3.2 Background Jobs - Vercel cron or external scheduler for delta sync

#### Phase 4: Admin UI
- [ ] 4.1 Admin Settings Page - /admin/sanmar with credentials, sync controls, history
- [ ] 4.2 Product Import Preview - Preview UI before committing bulk sync

#### Phase 5: Search & Display Integration
- [ ] 5.1 Next.js Image Config - Add cdnm.sanmar.com to remotePatterns
- [ ] 5.2 Search Enhancement - Index keywords, brand, category

### Key Technical Decisions
- **Remote Images:** Use SanMar CDN URLs directly (zero storage cost, auto-updates)
- **Product Tracking:** Store sanmarStyleId, sanmarPartId for re-sync capability
- **Variants:** Create Variant records for each color/size combination
- **Visibility:** Default to hidden, admin reviews before publishing

### Prerequisites (Before Development)
1. Email sanmarintegrations@sanmar.com with customer number
2. Sign integration agreement (e-signature)
3. Receive credentials (1-2 business days)
4. Request test environment access

### SanMar API Endpoints Used
- `getProductBulkInfo` - Full catalog CSV (monthly)
- `getProductDeltaInfo` - Incremental changes (daily)
- `getMediaContent` - Image URLs by productId
- `getInventoryQtyForStyleColorSize` - Stock levels
- PromoStandards `GetProduct` V2.0.0 - Detailed product data