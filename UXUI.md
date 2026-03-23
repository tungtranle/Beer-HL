# UX/UI Steering Guidelines for AI Interface Generation

## 1. Purpose

This document defines UX/UI design standards that AI systems must follow when generating interfaces for this product. The goal is to ensure **consistency, usability, scalability, and modern design standards** across all generated UI.

---

## 2. Core Design Principles

All generated interfaces must follow these core principles:

- **Clean and minimal**
- **Modern visual hierarchy**
- **Consistent component usage**
- **Reusable design patterns**
- **Accessibility friendly**
- **Mobile responsive by default**

Interfaces should avoid unnecessary visual complexity and prioritize **clarity and usability**.

---

## 3. Design System Requirement

### Mandatory UI Library

All UI components must use **Tailwind CSS** utility classes with **Next.js 14** (DEC-005).

### Rules

1. Use **Tailwind CSS utility classes** for all styling — no separate CSS files unless for animations/keyframes.
2. Do **NOT add Ant Design or other heavy UI frameworks** — Tailwind keeps bundle lightweight.
3. Prefer **composition of HTML + Tailwind** instead of custom CSS.
4. Follow consistent spacing and color token patterns via Tailwind config.

---

## 4. Component Reuse Policy

AI must follow this hierarchy when creating UI:

1. Use **Tailwind CSS utility classes** directly on HTML/JSX elements
2. Compose smaller components with consistent Tailwind patterns
3. Only create custom CSS (in `globals.css`) for **animations/keyframes** that Tailwind can't handle

Never create new UI controls that duplicate: **dropdown, dialog, form inputs, pagination, table, or tab navigation.**

---

## 5. Brand Color System

### Brand Primary Color

`rgb(246, 134, 52)` (Primary brand color)

### Usage Rules

The brand color must:

- Be used for **primary actions**
- Be used for **highlighting important elements**
- Be used for **active states**

### Brand Color Ratio Rule

The brand color must **not exceed 10%** of the visual area of a single screen/frame. This ensures the UI stays elegant, professional, and visually balanced.

---

## 6. Color Palette Guidelines

### Neutral Colors

- **Background:** #FFFFFF
- **Secondary Background:** #F7F8FA
- **Border:** #E5E6EB
- **Text Primary:** #1F1F1F
- **Text Secondary:** #595959
- **Disabled:** #BFBFBF

### Semantic Colors (Ant Design Defaults)

- **Success:** Green
- **Warning:** Orange/Yellow
- **Error:** Red
- **Info:** Blue

---

## 7. Layout System

### Grid System

Use **Ant Design Grid (24-column layout)**.
Example:

```jsx
<Row>
  <Col span={12} />
  <Col span={12} />
</Row>
```

### Spacing Scale

4px, 8px, 12px, 16px, 24px, 32px, 48px.
**Default spacing between components:** 16px or 24px.

---

## 8. Typography

### Font Preference

**Roboto** is the standardized font for this product. Always load Roboto from Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
  rel="stylesheet"
/>
```

Apply globally via CSS:

```css
body {
  font-family: "Roboto", sans-serif;
}
```

Fallback chain: `'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.

Do **NOT** mix other font families (e.g. Inter, system-ui) unless Roboto fails to load.

### Font Weight Standards

| Weight        | Usage                             |
| :------------ | :-------------------------------- |
| 300 (Light)   | Large display text, subtle labels |
| 400 (Regular) | Body text, default                |
| 500 (Medium)  | Subheadings, emphasis             |
| 700 (Bold)    | Page titles, strong emphasis      |

### Font Size Hierarchy

| Level         | Size    |
| :------------ | :------ |
| Page Title    | 24–28px |
| Section Title | 18–20px |
| Subsection    | 16px    |
| Body          | 14px    |
| Small         | 12px    |

---

## 9. Interaction Design & Forms

### Standard Patterns

- **Modal:** Confirmations
- **Drawer:** Secondary workflows
- **Tooltip:** Explanations
- **Popconfirm:** Destructive actions
- **Notification/Message:** System feedback

### Forms

Forms must follow Ant Design Form component structure. Use labels above inputs, show validation messages, and group related fields.

---

## 10. Data Display & Icons

### Data Display

Use **Table, List, Card, Descriptions, Tag, or Badge**. Tables should include sorting, filtering, and pagination.

### Icon System

Use **Ant Design Icons**. Icons must have clear meaning and consistent sizing. Avoid mixing icon libraries.

---

## 11. Responsive Design & Accessibility

- **Responsive:** Use Ant Design responsive grid and collapsible navigation. Avoid fixed-width layouts.
- **Accessibility:** Ensure sufficient color contrast, keyboard navigation, and clear labels. Avoid using color as the only way to convey meaning.

---

## 12. Visual Design Style

The interface should feel modern, professional, and lightweight. Avoid skeuomorphic design, heavy gradients, or excessive shadows. Prefer whitespace and subtle borders.
