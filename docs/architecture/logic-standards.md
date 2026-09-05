# Application Logic & Clean Code Standards

To maintain a high engineering standard, the Kapila project adheres to a strict Service-Oriented Architecture (SOA) and Enterprise React patterns. All new features and refactors must comply with these guidelines.

## 1. Backend Architecture: Service-Oriented Architecture (SOA)
The backend must strictly separate concerns into Routes, Controllers, and Services.

### Controllers (Thin)
- **Responsibility:** Handle HTTP requests and responses, parse inputs, and manage status codes.
- **Rules:** 
  - NEVER write business logic or complex database transformations inside a controller.
  - Controllers must extract data from `req` and pass it directly to the corresponding service function.
  - Controllers handle `try/catch` and forward errors to Express middleware (`next(err)`).

### Services (Fat)
- **Responsibility:** Execute all business rules, data validation, and database interactions.
- **Rules:**
  - Services contain the core "Logic of the App".
  - They should be reusable. A service function should not know about Express `req` or `res` objects.
  - Transactions must be instantiated and managed here when multiple writes occur.

### Data Access Layer
- Keep direct `db("table")` calls inside the service layer or a dedicated Repository layer. 

## 2. Error Handling & Validation
- **Do not swallow errors.** Use specific error throws in services (e.g., `throw new Error("Insufficient stock")`) and catch them in controllers.
- Validate all incoming payloads using **Zod** middleware before the controller is even invoked.

## 3. Frontend Architecture: Strict React Patterns
- **State Management:** Keep complex business logic out of the UI components. Use custom hooks (e.g., `useIssuanceLogic.js`) to encapsulate state and data fetching.
- **Immutability:** Never mutate React state directly.
- **Performance Optimization:** Use `useMemo` for heavy data transformations and `useCallback` for functions passed down as props to prevent unnecessary re-renders.

## 4. Documentation & Typings
- **JSDoc:** All core service functions and React custom hooks must have JSDoc comments defining parameter types and return types. This is critical for GitNexus to accurately map the semantic meaning of the code.
