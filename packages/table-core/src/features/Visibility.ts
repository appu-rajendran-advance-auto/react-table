import {
  Cell,
  Column,
  Getter,
  OnChangeFn,
  TableGenerics,
  PropGetterValue,
  TableInstance,
  Updater,
  Row,
} from '../types'
import { makeStateUpdater, memo, propGetter } from '../utils'

export type VisibilityOptions = {
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  enableHiding?: boolean
}

export type VisibilityDefaultOptions = {
  onColumnVisibilityChange: OnChangeFn<VisibilityState>
}

export type VisibilityState = Record<string, boolean>

export type VisibilityTableState = {
  columnVisibility: VisibilityState
}

export type VisibilityInstance<TGenerics extends TableGenerics> = {
  getVisibleFlatColumns: () => Column<TGenerics>[]
  getVisibleLeafColumns: () => Column<TGenerics>[]
  getLeftVisibleLeafColumns: () => Column<TGenerics>[]
  getRightVisibleLeafColumns: () => Column<TGenerics>[]
  getCenterVisibleLeafColumns: () => Column<TGenerics>[]
  setColumnVisibility: (updater: Updater<VisibilityState>) => void
  toggleColumnVisibility: (columnId: string, value?: boolean) => void
  toggleAllColumnsVisible: (value?: boolean) => void
  getColumnIsVisible: (columId: string) => boolean
  getColumnCanHide: (columnId: string) => boolean
  getIsAllColumnsVisible: () => boolean
  getIsSomeColumnsVisible: () => boolean
  getToggleAllColumnsVisibilityProps: <
    TGetter extends Getter<ToggleAllColumnsVisibilityProps>
  >(
    userProps?: TGetter
  ) => undefined | PropGetterValue<ToggleAllColumnsVisibilityProps, TGetter>
}

type ToggleVisibilityProps = {}
type ToggleAllColumnsVisibilityProps = {}

export type VisibilityColumnDef = {
  enableHiding?: boolean
  defaultCanHide?: boolean
  defaultIsVisible?: boolean
}

export type VisibilityRow<TGenerics extends TableGenerics> = {
  _getAllVisibleCells: () => Cell<TGenerics>[]
  getVisibleCells: () => Cell<TGenerics>[]
}

export type VisibilityColumn = {
  getCanHide: () => boolean
  getIsVisible: () => boolean
  toggleVisibility: (value?: boolean) => void
  getToggleVisibilityProps: <TGetter extends Getter<ToggleVisibilityProps>>(
    userProps?: TGetter
  ) => PropGetterValue<ToggleVisibilityProps, TGetter>
}

//

export const Visibility = {
  getInitialState: (): VisibilityTableState => {
    return {
      columnVisibility: {},
    }
  },

  getDefaultOptions: <TGenerics extends TableGenerics>(
    instance: TableInstance<TGenerics>
  ): VisibilityDefaultOptions => {
    return {
      onColumnVisibilityChange: makeStateUpdater('columnVisibility', instance),
    }
  },

  getDefaultColumn: () => {
    return {
      defaultIsVisible: true,
    }
  },

  createColumn: <TGenerics extends TableGenerics>(
    column: Column<TGenerics>,
    instance: TableInstance<TGenerics>
  ): VisibilityColumn => {
    return {
      getCanHide: () => instance.getColumnCanHide(column.id),
      getIsVisible: () => instance.getColumnIsVisible(column.id),
      toggleVisibility: value =>
        instance.toggleColumnVisibility(column.id, value),
      getToggleVisibilityProps: userProps => {
        const props: ToggleVisibilityProps = {
          type: 'checkbox',
          checked: column.getIsVisible?.(),
          title: 'Toggle Column Visibility',
          onChange: (e: unknown) => {
            column.toggleVisibility?.(
              ((e as MouseEvent).target as HTMLInputElement).checked
            )
          },
        }

        return propGetter(props, userProps)
      },
    }
  },

  createRow: <TGenerics extends TableGenerics>(
    row: Row<TGenerics>,
    instance: TableInstance<TGenerics>
  ): VisibilityRow<TGenerics> => {
    return {
      _getAllVisibleCells: memo(
        () => [
          row
            .getAllCells()
            .filter(cell => cell.column.getIsVisible())
            .map(d => d.id)
            .join('_'),
        ],
        _ => {
          return row.getAllCells().filter(cell => cell.column.getIsVisible())
        },
        {
          key: 'row._getAllVisibleCells',
          debug: () => instance.options.debugAll ?? instance.options.debugRows,
        }
      ),
      getVisibleCells: memo(
        () => [
          row.getLeftVisibleCells(),
          row.getCenterVisibleCells(),
          row.getRightVisibleCells(),
        ],
        (left, center, right) => [...left, ...center, ...right],
        {
          key: 'row.getVisibleCells',
          debug: () => instance.options.debugAll ?? instance.options.debugRows,
        }
      ),
    }
  },

  createInstance: <TGenerics extends TableGenerics>(
    instance: TableInstance<TGenerics>
  ): VisibilityInstance<TGenerics> => {
    const makeVisibleColumnsMethod = (
      key: string,
      getColumns: () => Column<TGenerics>[]
    ): (() => Column<TGenerics>[]) => {
      return memo(
        () => [
          getColumns(),
          getColumns()
            .filter(d => d.getIsVisible())
            .map(d => d.id)
            .join('_'),
        ],
        columns => {
          return columns.filter(d => d.getIsVisible?.())
        },
        {
          key,
          debug: () =>
            instance.options.debugAll ?? instance.options.debugColumns,
        }
      )
    }

    return {
      getVisibleFlatColumns: makeVisibleColumnsMethod(
        'getVisibleFlatColumns',
        () => instance.getAllFlatColumns()
      ),
      getVisibleLeafColumns: makeVisibleColumnsMethod(
        'getVisibleLeafColumns',
        () => instance.getAllLeafColumns()
      ),
      getLeftVisibleLeafColumns: makeVisibleColumnsMethod(
        'getLeftVisibleLeafColumns',
        () => instance.getLeftLeafColumns()
      ),
      getRightVisibleLeafColumns: makeVisibleColumnsMethod(
        'getRightVisibleLeafColumns',
        () => instance.getRightLeafColumns()
      ),
      getCenterVisibleLeafColumns: makeVisibleColumnsMethod(
        'getCenterVisibleLeafColumns',
        () => instance.getCenterLeafColumns()
      ),

      setColumnVisibility: updater =>
        instance.options.onColumnVisibilityChange?.(updater),

      toggleColumnVisibility: (columnId, value) => {
        if (!columnId) return

        if (instance.getColumnCanHide(columnId)) {
          instance.setColumnVisibility(old => ({
            ...old,
            [columnId]: value ?? !instance.getColumnIsVisible(columnId),
          }))
        }
      },

      toggleAllColumnsVisible: value => {
        value = value ?? !instance.getIsAllColumnsVisible()

        instance.setColumnVisibility(
          instance.getAllLeafColumns().reduce(
            (obj, column) => ({
              ...obj,
              [column.id]: !value ? !column.getCanHide?.() : value,
            }),
            {}
          )
        )
      },

      getColumnIsVisible: columnId => {
        const column = instance.getColumn(columnId)

        if (!column) {
          throw new Error()
        }

        return (
          instance.getState().columnVisibility?.[columnId] ??
          column.defaultIsVisible ??
          true
        )
      },

      getColumnCanHide: columnId => {
        const column = instance.getColumn(columnId)

        if (!column) {
          throw new Error()
        }

        return (
          instance.options.enableHiding ??
          column.enableHiding ??
          column.defaultCanHide ??
          true
        )
      },

      getIsAllColumnsVisible: () =>
        !instance.getAllLeafColumns().some(column => !column.getIsVisible?.()),

      getIsSomeColumnsVisible: () =>
        instance.getAllLeafColumns().some(column => column.getIsVisible?.()),

      getToggleAllColumnsVisibilityProps: userProps => {
        const props: ToggleAllColumnsVisibilityProps = {
          onChange: (e: MouseEvent) => {
            instance.toggleAllColumnsVisible(
              (e.target as HTMLInputElement)?.checked
            )
          },
          type: 'checkbox',
          title: 'Toggle visibility for all columns',
          checked: instance.getIsAllColumnsVisible(),
          indeterminate:
            !instance.getIsAllColumnsVisible() &&
            instance.getIsSomeColumnsVisible()
              ? 'indeterminate'
              : undefined,
        }

        return propGetter(props, userProps)
      },
    }
  },
}
