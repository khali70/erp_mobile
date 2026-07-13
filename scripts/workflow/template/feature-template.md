## FEATURE NAME

Login Feature

---

## FIGMA

https://www.figma.com/file/xxxxx

OR (MCP link if available)

---

## API SPEC

POST /auth/login

Request:
{
"email": "string",
"password": "string"
}

Response:
{
"token": "string",
"user": {
"id": "int",
"name": "string"
}
}

---

## BEHAVIOR

- User enters email/password
- Tap login button
- Show loading state
- On success → navigate to Home
- On failure → show error message

---

## REQUIREMENTS

- Must support Arabic/English
- Must be responsive
- Must follow Clean Architecture
- Must use existing theme
- Must use Cubit for state management

---

## NOTES (optional)

- Remember password feature not needed
- Social login not included
