import {LitElement, PropertyValueMap, html, css}   from 'lit';
import {query}                      from 'lit/decorators/query.js';
import {customElement, property}    from 'lit/decorators.js';

/**
 * FlowyDiagram a webcomponent containing a canvas to manage diagram drawing
 * 
 * @tag &lt;flowy-diagram&gt;
 */
@customElement('drop-target')
export class DropTarget extends LitElement {
    static styles = css`
    #canvas {
      background-color: green;
      width: 100%;
      height: 100%
    }s
    `

    @query('#canvas')
    private canvas_div!: HTMLElement;

    #draggingElement: HTMLElement|null = null

    /**
     * disable shadow root
     * 
     * @returns 
     * @see [How to create LitElement without Shadow DOM?](https://stackoverflow.com/a/55213037/521197)
     */
    createRenderRoot() {
        return this;
    }

    protected render(): unknown {
        
        return html`
            <div id="canvas">
            </div>`
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {

        const dragover = ( e:DragEvent ) => {
            
            console.debug( 'dragover', e.target)

            e.preventDefault()

            this.setAttribute("active", "");

            if( !this.#draggingElement ) {
                // const rootElement = this.getRootNode() as Element
                const rootElement = document

                this.#draggingElement = rootElement.querySelector("[dragging]");
    
            }
       
        }

        const drop = ( e:DragEvent ) => {
            const target = e.target as HTMLElement

            console.debug( 'drop',this.#draggingElement, target.id )
        
            if( !this.#draggingElement ) return 

            e.preventDefault();

            this.canvas_div.appendChild(this.#draggingElement);
            // this.#draggingElement.removeAttribute('draggable')
            this.removeAttribute("active");
            this.#draggingElement = null;    
        }
    
    
        const dragleave = ( e:DragEvent ) => {
            
            console.debug( 'dragleave', e.target)

            this.removeAttribute("active");
        }
    
        this.addEventListener("drop", drop );
        this.addEventListener("dragover", dragover );
        this.addEventListener("dragleave", dragleave);

    }

    load() {
        const dragstart = ( e:DragEvent ) => {

            console.debug( 'dragstart', e.target)
            e.dataTransfer?.setData("text/html", "test")
    
            const target = e.target as HTMLElement
            target.setAttribute("dragging", "")
        }
    
        const drag = ( e:DragEvent ) => {
    
            console.debug( 'drag', e.target)
        }
    
        const dragend = ( e:DragEvent ) => {
    
            console.debug( 'dragend', e.target)
    
            const target = e.target as HTMLElement
            target.removeAttribute("dragging");
    
    
        }
    
    
        [...document.querySelectorAll("[draggable]")].forEach( e => {
    
            const element = e as HTMLElement
    
            element.addEventListener("dragstart", dragstart )
            element.addEventListener("dragend", dragend )
            element.addEventListener("drag", drag )
    
        })
    
    }
}

document.addEventListener("DOMContentLoaded", () => {

    const target = document.getElementById('target') as DropTarget

    target.load()

})