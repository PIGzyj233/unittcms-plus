import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Button, Tab, Tabs } from './heroui';

describe('HeroUI compatibility Button', () => {
  test('renders primary light links as visible primary text links', () => {
    const markup = renderToStaticMarkup(
      <Button as="a" href="/account/signup" color="primary" variant="light">
        You need sign up?
      </Button>
    );
    const className = markup.match(/class="([^"]+)"/)?.[1] ?? '';
    const classes = className.split(/\s+/);

    expect(markup).toContain('href="/account/signup"');
    expect(markup).toContain('You need sign up?');
    expect(classes).toContain('text-primary');
    expect(classes).not.toContain('bg-primary');
    expect(classes).not.toContain('text-primary-foreground');
  });
});

describe('HeroUI compatibility Tabs', () => {
  test('renders the controlled tab content for a normal React key', () => {
    const markup = renderToStaticMarkup(
      <Tabs selectedKey="draft">
        <Tab key="draft" title="Draft">
          Draft content
        </Tab>
        <Tab key="accepted" title="Accepted">
          Accepted content
        </Tab>
      </Tabs>
    );

    expect(markup).toContain('Draft content');
    expect(markup).not.toContain('Accepted content');
  });
});
