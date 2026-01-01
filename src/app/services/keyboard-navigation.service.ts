import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class KeyboardNavigationService {
  private focusableElements: HTMLElement[] = [];
  private currentFocusIndex = 0;

  updateFocusableElements(containerSelector: string, excludeSelector?: string): void {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const buttons = Array.from(container.querySelectorAll('button:not([disabled])')) as HTMLElement[];
    const inputs = Array.from(container.querySelectorAll('input:not([disabled])')) as HTMLElement[];
    
    let links: HTMLElement[] = [];
    if (excludeSelector) {
      links = Array.from(container.querySelectorAll(`a:not(${excludeSelector})`)) as HTMLElement[];
    } else {
      links = Array.from(container.querySelectorAll('a')) as HTMLElement[];
    }
    
    this.focusableElements = [...buttons, ...inputs, ...links].filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
    
    this.currentFocusIndex = 0;
  }

  focusElement(selector: string): boolean {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      const index = this.focusableElements.indexOf(element);
      if (index !== -1) {
        this.currentFocusIndex = index;
        element.focus();
        return true;
      }
    }
    return false;
  }

  focusFirstElement(): void {
    if (this.focusableElements.length > 0) {
      this.focusableElements[0]?.focus();
    }
  }

  focusDown(): void {
    if (this.focusableElements.length === 0) return;
    this.updateCurrentIndex();

    const currentElement = this.focusableElements[this.currentFocusIndex];
    const rows = this.groupElementsIntoRows();
    const position = this.findElementInRows(rows, currentElement);

    if (!position || position.rowIndex >= rows.length - 1) return;

    const nextRow = rows[position.rowIndex + 1];
    const targetCol = Math.min(position.colIndex, nextRow.length - 1);
    const targetElement = nextRow[targetCol];

    this.currentFocusIndex = this.focusableElements.indexOf(targetElement);
    this.focusableElements[this.currentFocusIndex]?.focus();
    this.triggerInputKeyboard(this.focusableElements[this.currentFocusIndex]);
  }

  focusUp(): void {
    if (this.focusableElements.length === 0) return;
    this.updateCurrentIndex();

    const currentElement = this.focusableElements[this.currentFocusIndex];
    const rows = this.groupElementsIntoRows();
    const position = this.findElementInRows(rows, currentElement);

    if (!position || position.rowIndex <= 0) return;

    const prevRow = rows[position.rowIndex - 1];
    const targetCol = Math.min(position.colIndex, prevRow.length - 1);
    const targetElement = prevRow[targetCol];

    this.currentFocusIndex = this.focusableElements.indexOf(targetElement);
    this.focusableElements[this.currentFocusIndex]?.focus();
    this.triggerInputKeyboard(this.focusableElements[this.currentFocusIndex]);
  }

  focusRight(): void {
    if (this.focusableElements.length === 0) return;
    this.updateCurrentIndex();

    const currentElement = this.focusableElements[this.currentFocusIndex];
    const rows = this.groupElementsIntoRows();
    const position = this.findElementInRows(rows, currentElement);

    if (!position) return;

    const currentRow = rows[position.rowIndex];
    if (position.colIndex >= currentRow.length - 1) return;

    const targetElement = currentRow[position.colIndex + 1];
    this.currentFocusIndex = this.focusableElements.indexOf(targetElement);
    this.focusableElements[this.currentFocusIndex]?.focus();
    this.triggerInputKeyboard(this.focusableElements[this.currentFocusIndex]);
  }

  focusLeft(): void {
    if (this.focusableElements.length === 0) return;
    this.updateCurrentIndex();

    const currentElement = this.focusableElements[this.currentFocusIndex];
    const rows = this.groupElementsIntoRows();
    const position = this.findElementInRows(rows, currentElement);

    if (!position) return;

    const currentRow = rows[position.rowIndex];
    if (position.colIndex <= 0) return;

    const targetElement = currentRow[position.colIndex - 1];
    this.currentFocusIndex = this.focusableElements.indexOf(targetElement);
    this.focusableElements[this.currentFocusIndex]?.focus();
    this.triggerInputKeyboard(this.focusableElements[this.currentFocusIndex]);
  }

  activateFocusedElement(): void {
    if (this.focusableElements.length === 0) return;
    this.updateCurrentIndex();

    const focusedElement = this.focusableElements[this.currentFocusIndex];
    focusedElement?.click();
  }

  private triggerInputKeyboard(element: HTMLElement | undefined): void {
    // On Android TV, clicking the input after focus helps trigger the keyboard
    if (element && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      setTimeout(() => {
        element.click();
      }, 50);
    }
  }

  private updateCurrentIndex(): void {
    const actuallyFocused = document.activeElement as HTMLElement;
    const actualIndex = this.focusableElements.indexOf(actuallyFocused);
    if (actualIndex !== -1) {
      this.currentFocusIndex = actualIndex;
    }
  }

  private getElementPosition(element: HTMLElement): { top: number; left: number } {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  }

  private groupElementsIntoRows(): HTMLElement[][] {
    const rows: HTMLElement[][] = [];
    const rowThreshold = 30;

    for (const element of this.focusableElements) {
      const pos = this.getElementPosition(element);
      let foundRow = false;

      for (const row of rows) {
        const rowPos = this.getElementPosition(row[0]);
        if (Math.abs(pos.top - rowPos.top) < rowThreshold) {
          row.push(element);
          foundRow = true;
          break;
        }
      }

      if (!foundRow) {
        rows.push([element]);
      }
    }

    rows.forEach(row => row.sort((a, b) => 
      this.getElementPosition(a).left - this.getElementPosition(b).left
    ));

    rows.sort((a, b) => 
      this.getElementPosition(a[0]).top - this.getElementPosition(b[0]).top
    );

    return rows;
  }

  private findElementInRows(rows: HTMLElement[][], element: HTMLElement): { rowIndex: number; colIndex: number } | null {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const colIndex = rows[rowIndex].indexOf(element);
      if (colIndex !== -1) {
        return { rowIndex, colIndex };
      }
    }
    return null;
  }
}
