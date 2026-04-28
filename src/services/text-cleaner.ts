/**
 * TextCleaner handles the initial sanitization of MTL (Machine Translation) text.
 * It applies regex-based filters to remove noise and normalize formatting.
 */
export class TextCleaner {
  /**
   * Main cleaning pipeline.
   */
  clean(text: string): string {
    let result = text;
    result = this.removeConsecutiveBlankLines(result);
    result = this.stripEditorCommentary(result);
    result = this.normalizeSceneDividers(result);
    return result.trim();
  }

  /**
   * Filter: Remove consecutive blank lines.
   * Replaces 3 or more consecutive newlines with exactly two.
   *
   * Test Case: "Line 1\n\n\n\nLine 2" -> "Line 1\n\nLine 2"
   */
  private removeConsecutiveBlankLines(text: string): string {
    return text.replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Filter: Detect and strip specific editor commentary tags.
   * Common patterns in MTL: (Editor: ...), [Note: ...], {TL: ...}
   *
   * Test Case: "Hello (Editor: remove this) world" -> "Hello  world"
   */
  private stripEditorCommentary(text: string): string {
    // Patterns for (Editor: ...), [Note: ...], {TL: ...} or just (TL)
    const patterns = [
      /\((Editor|TL|Note|ED):.*?\)/gi,
      /\[(Editor|TL|Note|ED):.*?\]/gi,
      /\{(Editor|TL|Note|ED):.*?\}/gi,
    ];

    let result = text;
    for (const pattern of patterns) {
      result = result.replace(pattern, '');
    }
    return result;
  }

  /**
   * Filter: Normalize scene dividers.
   * Converts various patterns like ***, ---, === into a standard --- divider.
   *
   * Test Case: "End of scene\n   ***   \nNext scene" -> "End of scene\n---\nNext scene"
   */
  private normalizeSceneDividers(text: string): string {
    // Matches lines containing only 3 or more of *, -, or = with optional spaces
    const dividerPattern = /^\s*([*-=])\s*\1\s*\1[*-=\s]*$/gm;
    return text.replace(dividerPattern, '---');
  }
}
